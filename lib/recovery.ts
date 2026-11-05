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
import { activeOffer, offerPrice } from '@/lib/offers';
import { FREE_TRIAL_LAUNCH, freeTrialEnd } from '@/lib/access';
import { marketOf } from '@/lib/market';

const HOUR = 3600000;
const MIN_GAP = 20 * HOUR;
// Prazo antigo do Founders: o aviso de prorrogação só vai para quem se cadastrou antes dele.
const OLD_DEADLINE = Date.parse('2026-10-31T23:59:59-03:00');

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
export function dueKind(user: Pick<User, 'created_at'>, sent: Sent, now = new Date(), opts: { ext?: boolean; offer?: boolean; hasOffer?: boolean } = {}): RecoveryKind | null {
  // Disparo manual da condição especial: só quem tem a oferta na conta, uma vez.
  if (opts.offer) return opts.hasOffer && !sent.of1 ? 'of1' : null;
  const h = (now.getTime() - new Date(user.created_at).getTime()) / HOUR;
  if (h < 2) return null;
  const last = Math.max(0, ...Object.values(sent).map((v) => (v ? Date.parse(v) : 0)));
  const today = isoInBrazil(now);
  const end = isoInBrazil(FOUNDERS_ENDS_AT);
  const dayBefore = isoInBrazil(new Date(FOUNDERS_ENDS_AT.getTime() - 24 * HOUR));
  // Os avisos de prazo valem para o prazo atual: quem recebeu os de 31/10 recebe de novo perto de 30/11.
  const forThisDeadline = (v?: string) => !!v && Date.parse(v) > FOUNDERS_ENDS_AT.getTime() - 7 * 24 * HOUR;
  if (foundersOpen(now)) {
    if (today === end && !forThisDeadline(sent.fd2) && now.getTime() - last >= 10 * HOUR) return 'fd2';
    if (today === dayBefore && !forThisDeadline(sent.fd1) && now.getTime() - last >= MIN_GAP) return 'fd1';
    // Aviso de prorrogação: só no disparo manual do dono, para quem já tinha recebido algum lembrete (viu o prazo antigo).
    if (opts.ext && !opts.hasOffer && !sent.ext1 && Date.parse(user.created_at) < OLD_DEADLINE && Object.keys(sent).some((k) => k !== 'ext1')) return 'ext1';
  }
  if (now.getTime() - last < MIN_GAP) return null;
  // Sempre começa pelo "você quase concluiu"; os próximos respeitam o tempo de conta e o intervalo.
  if (!sent.pv1) return 'pv1';
  if (h >= 24 && !sent.pv2) return 'pv2';
  if (h >= 72 && !sent.pv3) return 'pv3';
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

export async function runRecovery({ dryRun = false, now = new Date(), ext = false, offer = false } = {}) {
  const admin = createAdminClient();
  const [users, { data: subs }] = await Promise.all([allUsers(), admin.from('subscriptions').select('user_id')]);
  const subscribed = new Set((subs ?? []).map((s) => s.user_id as string));
  const result = { candidates: 0, sent: 0, failed: 0, plan: [] as { email: string; kind: RecoveryKind }[] };

  for (const u of users) {
    if (!u.email || subscribed.has(u.id) || isOwner(u.email)) continue;
    if (u.app_metadata?.email_optout) continue;
    // Portugal tem a trilha própria em lib/nurture (português de Portugal, preço em euro).
    if (marketOf(u) === 'pt') continue;
    // Teste grátis sem cartão: quem está nele ou entrou depois do lançamento recebe a trilha de engajamento (lib/nurture).
    if (!offer && !ext && (Date.parse(u.created_at) >= FREE_TRIAL_LAUNCH || freeTrialEnd(u).getTime() > now.getTime())) {
      const k = dueKind(u, ((u.app_metadata?.recovery as Sent | undefined) ?? {}) as Sent, now);
      if (k !== 'fd1' && k !== 'fd2') continue;
    }
    // Conta criada antes da prévia existir também entra: agora ela pode ver a estratégia sem cartão.
    const sent = ((u.app_metadata?.recovery as Sent | undefined) ?? {}) as Sent;
    const hasOffer = !!activeOffer(u, now);
    const kind = dueKind(u, sent, now, { ext, offer, hasOffer });
    if (!kind) continue;
    // Recebeu e-mail de engajamento (lib/nurture) há pouco: espera, salvo os avisos de prazo.
    const nurtured = Math.max(0, ...Object.values((u.app_metadata?.nurture as Record<string, unknown> | undefined) ?? {}).map((v) => (typeof v === 'string' && v.includes('T') ? Date.parse(v) : 0)));
    if (kind !== 'fd1' && kind !== 'fd2' && kind !== 'of1' && kind !== 'ext1' && now.getTime() - nurtured < MIN_GAP) continue;
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
      offer: hasOffer ? { price: offerPrice(plan, now), plan } : undefined,
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
    const nextSent: Sent = { ...sent, [kind]: now.toISOString() };
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
    offer: kind === 'of1' ? { price: offerPrice('pro', now), plan: 'pro' } : undefined,
  });
}
