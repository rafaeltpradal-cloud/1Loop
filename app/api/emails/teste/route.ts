import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { chargeReminderEmail, nudgeEmail } from '@/lib/emails/trial';
import { isPlanId, PLANS } from '@/lib/plans';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DAY = 86400000;

// POST /api/emails/teste — chamado 1x por dia (pg_cron, 10h).
// Cada e-mail sai uma vez por pessoa (tabela email_log), então chamar de novo não repete nada.
export async function POST() {
  const admin = createAdminClient();
  const now = Date.now();
  const { data: subs } = await admin
    .from('subscriptions')
    .select('user_id, plan, status, trial_end, created_at')
    .eq('status', 'trialing')
    .gt('trial_end', new Date(now).toISOString());

  // Só a assinatura mais recente de cada pessoa.
  type Row = { user_id: string; plan: string; trial_end: string; created_at: string };
  const latest = new Map<string, Row>();
  for (const s of (subs ?? []) as Row[]) {
    const prev = latest.get(s.user_id);
    if (!prev || s.created_at > prev.created_at) latest.set(s.user_id, s);
  }

  const app = siteUrl();
  const result = { nudge: 0, charge: 0, skipped: 0 };

  for (const s of latest.values()) {
    const trialEnd = new Date(s.trial_end);
    const left = trialEnd.getTime() - now;
    const elapsed = 7 * DAY - left; // tempo desde o começo do teste
    const kind = left <= 2 * DAY ? 'teste_cobranca' : elapsed >= 2 * DAY ? 'teste_dia3' : null;
    if (!kind) continue;

    const { data: sent } = await admin.from('email_log').select('kind').eq('user_id', s.user_id).eq('kind', kind).maybeSingle();
    if (sent) continue;

    const [{ count: posts }, { data: profile }, { data: interview }, { count: strategies }, { data: u }] = await Promise.all([
      admin.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', s.user_id),
      admin.from('profiles').select('name').eq('id', s.user_id).maybeSingle(),
      admin.from('interviews').select('completed_at').eq('user_id', s.user_id).not('completed_at', 'is', null).limit(1).maybeSingle(),
      admin.from('strategies').select('id', { count: 'exact', head: true }).eq('user_id', s.user_id),
      admin.auth.admin.getUserById(s.user_id),
    ]);
    const email = u?.user?.email;
    if (!email) continue;
    const firstName = ((profile?.name as string | undefined) ?? '').trim().split(/\s+/)[0] || 'Olá';

    let mail: { subject: string; html: string; text: string } | null = null;
    if (kind === 'teste_dia3') {
      if ((posts ?? 0) > 0) {
        // Já gerou conteúdo: não precisa do lembrete. Marca para não checar de novo.
        await admin.from('email_log').insert({ user_id: s.user_id, kind });
        result.skipped++;
        continue;
      }
      const step = !interview ? 'entrevista' : !strategies ? 'estrategia' : 'conteudos';
      mail = nudgeEmail({ firstName, appUrl: app, step });
    } else {
      const plan = isPlanId(s.plan) ? s.plan : 'pro';
      const p = PLANS[plan];
      mail = chargeReminderEmail({ firstName, appUrl: app, planName: p.name, amount: p.priceFounders ?? p.priceFull, trialEnd, posts: posts ?? 0 });
    }

    const ok = await sendEmail({ to: email, ...mail });
    if (ok) {
      await admin.from('email_log').insert({ user_id: s.user_id, kind });
      if (kind === 'teste_dia3') result.nudge++;
      else result.charge++;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
