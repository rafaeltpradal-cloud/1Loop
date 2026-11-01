// Condição especial individual: 10% abaixo do preço Founders no 1º mês pago.
// Dada a quem chegou ao pagamento enquanto o Stripe estava suspenso (out/nov 2026).
// Fica em app_metadata da conta: { offer: { id: 'founders10', until: ISO, used?: ISO } }.
// O checkout continua com o cupom Founders (o Stripe Checkout aceita um cupom só); quando a assinatura
// é criada, o webhook soma o cupom extra (vale 1 mês, então cai na 1ª cobrança depois dos 7 dias grátis).
import type Stripe from 'stripe';
import type { User } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { priceNow } from '@/lib/founders';
import type { PlanId } from '@/lib/plans';

export type Offer = { id: 'founders10'; until: string; used?: string };

export const OFFER_PCT = 10;

/** Cupons do Stripe (valor fixo, duração "1 mês"): 10% do preço Founders de cada plano. */
export function offerCoupon(plan: PlanId): string | undefined {
  if (plan === 'pro') return process.env.STRIPE_COUPON_OFFER_PRO || 'FOUNDERS10_PRO';
  if (plan === 'basic') return process.env.STRIPE_COUPON_OFFER_BASIC || 'FOUNDERS10_BASIC';
  return undefined;
}

export function activeOffer(user: Pick<User, 'app_metadata'> | null | undefined, now = new Date()): Offer | null {
  const o = user?.app_metadata?.offer as Offer | undefined;
  if (!o || o.id !== 'founders10' || o.used) return null;
  if (Date.parse(o.until) < now.getTime()) return null;
  return o;
}

/** Preço do 1º mês com a condição (R$/mês). */
export function offerPrice(plan: PlanId, now = new Date()) {
  return Math.round(priceNow(plan, now) * (100 - OFFER_PCT)) / 100;
}

export { money } from '@/lib/plans';

/** Chamado pelo webhook depois do checkout: soma o cupom extra à assinatura e marca a condição como usada. */
export async function applyOfferToSubscription(userId: string, subscriptionId: string) {
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    const user = data?.user;
    const offer = activeOffer(user);
    if (!user || !offer) return;
    const sub = await stripe().subscriptions.retrieve(subscriptionId);
    const plan = ((sub.metadata?.plan as PlanId | undefined) || 'pro') as PlanId;
    const coupon = offerCoupon(plan);
    if (!coupon) return;
    const current = ((sub as unknown as { discounts?: (string | Stripe.Discount)[] }).discounts ?? []).map((d) => ({ discount: typeof d === 'string' ? d : d.id }));
    await stripe().subscriptions.update(subscriptionId, { discounts: [...current, { coupon }] });
    await admin.auth.admin.updateUserById(userId, { app_metadata: { ...user.app_metadata, offer: { ...offer, used: new Date().toISOString() } } });
  } catch (err) {
    console.error('[oferta 10%]', err); // nunca derruba o webhook
  }
}
