// Indique e ganhe: quem indica ganha 1 mês grátis quando a pessoa indicada paga a primeira mensalidade.
// O link é /?ref=<8 primeiros caracteres do id da conta>; o código vai junto da origem do cadastro (profiles.origem.ref).
// O mês grátis entra como crédito no Stripe (saldo do cliente), descontado na próxima fatura de quem indicou.
import type Stripe from 'stripe';
import { stripe, siteUrl } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { priceNow } from '@/lib/founders';
import { isPlanId, type PlanId } from '@/lib/plans';

export const refCode = (userId: string) => userId.replace(/-/g, '').slice(0, 8).toLowerCase();
export const refLink = (userId: string) => `${siteUrl()}/?ref=${refCode(userId)}`;

type Admin = ReturnType<typeof createAdminClient>;

async function userByCode(admin: Admin, code: string) {
  if (!/^[a-f0-9]{8}$/.test(code)) return null;
  const { data } = await admin.from('profiles').select('id');
  return ((data ?? []) as { id: string }[]).find((p) => refCode(p.id) === code)?.id ?? null;
}

/** Crédito de 1 mês (preço atual do plano) no saldo do cliente no Stripe. */
async function creditMonth(customerId: string, plan: PlanId, note: string) {
  const cents = Math.round(priceNow(plan) * 100);
  await stripe().customers.createBalanceTransaction(customerId, { amount: -cents, currency: 'brl', description: note });
}

/** Chamado pelo webhook quando uma assinatura vira paga (fim do teste). Dá o mês grátis a quem indicou, uma vez por indicado. */
export async function rewardReferral(sub: Stripe.Subscription) {
  try {
    const admin = createAdminClient();
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const { data: prof } = await admin.from('profiles').select('id, name, origem').eq('stripe_customer_id', customerId).maybeSingle();
    const code = ((prof?.origem as { ref?: string } | null)?.ref ?? '').toLowerCase();
    if (!prof || !code) return;
    const referrerId = await userByCode(admin, code);
    if (!referrerId || referrerId === prof.id) return;

    const { data: referred } = await admin.auth.admin.getUserById(prof.id as string);
    if (!referred?.user || referred.user.app_metadata?.referral_rewarded) return;
    await admin.auth.admin.updateUserById(prof.id as string, { app_metadata: { ...referred.user.app_metadata, referral_rewarded: referrerId } });

    const { data: ref } = await admin.auth.admin.getUserById(referrerId);
    const meta = (ref?.user?.app_metadata?.referral as { rewarded?: number; pending?: number } | undefined) ?? {};
    const { data: refSub } = await admin.from('subscriptions').select('stripe_customer_id, plan, status').eq('user_id', referrerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const firstName = String(prof.name ?? '').split(' ')[0] || 'sua indicação';
    if (refSub?.stripe_customer_id && ['active', 'trialing', 'past_due'].includes(refSub.status as string)) {
      await creditMonth(refSub.stripe_customer_id as string, isPlanId(refSub.plan) ? refSub.plan : 'pro', `Indique e ganhe: 1 mês grátis (${firstName} assinou)`);
      await admin.auth.admin.updateUserById(referrerId, { app_metadata: { ...ref?.user?.app_metadata, referral: { ...meta, rewarded: (meta.rewarded ?? 0) + 1 } } });
    } else {
      // Quem indicou ainda não assina: o mês fica guardado e entra quando assinar.
      await admin.auth.admin.updateUserById(referrerId, { app_metadata: { ...ref?.user?.app_metadata, referral: { ...meta, rewarded: (meta.rewarded ?? 0) + 1, pending: (meta.pending ?? 0) + 1 } } });
    }
  } catch (err) {
    console.error('[indique e ganhe]', err);
  }
}

/** No checkout de quem tinha meses guardados: vira crédito no Stripe. */
export async function applyPendingReferral(userId: string, customerId: string, plan: PlanId) {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    const meta = (data?.user?.app_metadata?.referral as { rewarded?: number; pending?: number } | undefined) ?? {};
    if (!data?.user || !meta.pending) return;
    await admin.auth.admin.updateUserById(userId, { app_metadata: { ...data.user.app_metadata, referral: { ...meta, pending: 0 } } });
    for (let i = 0; i < meta.pending; i++) await creditMonth(customerId, plan, 'Indique e ganhe: mês grátis guardado');
  } catch (err) {
    console.error('[indique e ganhe pendente]', err);
  }
}
