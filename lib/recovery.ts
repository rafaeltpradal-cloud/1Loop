// Recuperação de quem criou a conta e não começou o teste (prévia sem cartão).
// Roda 1x por dia (cron da Vercel, 10h de Brasília). Cada e-mail sai no máximo uma vez por pessoa,
// com intervalo mínimo entre e-mails, e para quando a pessoa assina ou pede para sair.
// O registro fica em app_metadata da conta (a pessoa não consegue editar): { recovery: { pv1: iso, ... }, email_optout: true }.
import { createHmac } from 'crypto';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { recoveryEmail, type RecoveryKind } from '@/lib/emails/recovery';
import { chosenPlan } from '@/lib/access';
import { FOUNDERS_ENDS_AT, FOUNDERS_ENDS_LABEL, foundersDaysLeft, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS } from '@/lib/plans';
import { QUESTIONS } from '@/lib/interview';
import { isOwner } from '@/lib/owner';
import { siteUrl } from '@/lib/stripe';
import { isoInBrazil } from '@/lib/dates';

const HOUR = 3600000;
const MIN_GAP = 20 * HOUR;

function secret() {
  const s = process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Sem chave para assinar links');
  return s;
}

export function unsubscribeToken(userId: string) {
  return createHmac('sha256', `1loop-sair:${secret()}`).update(userId).digest('base64url').slice(0, 32);
}

export function unsubscribeUrl(userId: string) {
  return `${siteUrl()}/api/emails/sair?u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
}

export async function optOut(userId: string, token: string) {
  if (!token || token !== unsubscribeToken(userId)) return false;
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data?.user) return false;
  await admin.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, email_optout: true } });
  return true;
}

type Sent = Partial<Record<RecoveryKind, string>>;

/** Qual e-mail cabe agora (no máximo um). Os de prazo do Founders têm prioridade. */
export function dueKind(user: Pick<User, 'created_at'>, sent: Sent, now = new Date()): RecoveryKind | null {
  const h = (now.getTime() - new Date(user.created_at).getTime()) / HOUR;
  if (h < 2) return null;
  const last = Math.max(0, ...Object.values(sent).map((v) => (v ? Date.parse(v) : 0)));
  const today = isoInBrazil(now);
  const end = isoInBrazil(FOUNDERS_ENDS_AT);
  const dayBefore = isoInBrazil(new Date(FOUNDERS_ENDS_AT.getTime() - 24 * HOUR));
  if (foundersOpen(now)) {
    if (today === end && !sent.fd2 && now.getTime() - last >= 10 * HOUR) return 'fd2';
    if (today === dayBefore && !sent.fd1 && now.getTime() - last >= MIN_GAP) return 'fd1';
  }
  if (now.getTime() - last < MIN_GAP) return null;
  if (h >= 72 && !sent.pv3) return 'pv3';
  if (h >= 24 && !sent.pv2 && !sent.pv3) return 'pv2';
  if (!sent.pv1 && !sent.pv2 && !sent.pv3) return 'pv1';
  return null;
}

async function allUsers() {
  const admin = createAdminClient();
  const out: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

export async function runRecovery({ dryRun = false, now = new Date() } = {}) {
  const admin = createAdminClient();
  const [users, { data: subs }] = await Promise.all([allUsers(), admin.from('subscriptions').select('user_id')]);
  const subscribed = new Set((subs ?? []).map((s) => s.user_id as string));
  const result = { candidates: 0, sent: 0, failed: 0, plan: [] as { email: string; kind: RecoveryKind }[] };

  for (const u of users) {
    if (!u.email || subscribed.has(u.id) || isOwner(u.email)) continue;
    if (u.app_metadata?.email_optout) continue;
    // Conta criada antes da prévia existir também entra: agora ela pode ver a estratégia sem cartão.
    const sent = ((u.app_metadata?.recovery as Sent | undefined) ?? {}) as Sent;
    const kind = dueKind(u, sent, now);
    if (!kind) continue;
    result.candidates++;

    const [{ data: profile }, { data: interview }, { count: strategies }, { data: posts }] = await Promise.all([
      admin.from('profiles').select('name').eq('id', u.id).maybeSingle(),
      admin.from('interviews').select('answers, completed_at').eq('user_id', u.id).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      admin.from('strategies').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      admin.from('posts').select('id').eq('user_id', u.id).order('created_at').limit(3),
    ]);
    const name = ((profile?.name as string | undefined) || (u.user_metadata?.name as string | undefined) || '').trim();
    const firstName = name.split(/\s+/)[0] || 'Oi';
    const plan = chosenPlan(u);
    const mail = recoveryEmail({
      kind,
      firstName,
      appUrl: siteUrl(),
      unsubscribeUrl: unsubscribeUrl(u.id),
      stage: {
        answered: interview?.answers ? Object.keys(interview.answers as object).filter((k) => QUESTIONS.some((q) => q.id === k)).length : 0,
        total: QUESTIONS.length,
        interviewDone: !!interview?.completed_at,
        hasStrategy: (strategies ?? 0) > 0,
        posts: posts?.length ?? 0,
        firstPostId: (posts?.[0]?.id as number | undefined) ?? null,
      },
      plan: { name: PLANS[plan].name, full: PLANS[plan].priceFull, now: priceNow(plan, now) },
      founders: { open: foundersOpen(now), daysLeft: foundersDaysLeft(now), label: FOUNDERS_ENDS_LABEL },
    });

    if (dryRun) {
      result.plan.push({ email: u.email, kind });
      continue;
    }
    const ok = await sendEmail({
      to: u.email,
      ...mail,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl(u.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (!ok) {
      result.failed++;
      continue;
    }
    // Ao mandar um e-mail mais adiantado, os anteriores da sequência não saem mais.
    const stamp = now.toISOString();
    const nextSent: Sent = { ...sent, [kind]: stamp };
    if (kind === 'pv2' || kind === 'pv3') nextSent.pv1 ??= stamp;
    if (kind === 'pv3') nextSent.pv2 ??= stamp;
    await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...u.app_metadata, recovery: nextSent } });
    result.sent++;
  }
  return result;
}

/** Prévia de um e-mail (para o dono conferir o texto). */
export function sampleRecovery(kind: RecoveryKind, stage: 'parou' | 'pronto' = 'pronto', now = new Date()) {
  return recoveryEmail({
    kind,
    firstName: 'Rafael',
    appUrl: siteUrl(),
    unsubscribeUrl: `${siteUrl()}/api/emails/sair?u=exemplo&t=exemplo`,
    stage: stage === 'parou'
      ? { answered: 6, total: QUESTIONS.length, interviewDone: false, hasStrategy: false, posts: 0, firstPostId: null }
      : { answered: QUESTIONS.length, total: QUESTIONS.length, interviewDone: true, hasStrategy: true, posts: 1, firstPostId: null },
    plan: { name: PLANS.pro.name, full: PLANS.pro.priceFull, now: priceNow('pro', now) },
    founders: { open: foundersOpen(now), daysLeft: foundersDaysLeft(now), label: FOUNDERS_ENDS_LABEL },
  });
}
