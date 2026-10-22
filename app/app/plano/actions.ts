'use server';

import { revalidatePath } from 'next/cache';
import type Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { ACTIVE_STATUSES, syncSubscription } from '@/lib/billing';
import { PLANS, foundersCoupon, isPlanId, stripePriceId } from '@/lib/plans';

// Troca o plano da assinatura atual. Mantém o teste de 7 dias, aplica o Founders do novo plano
// (se ainda houver) e ajusta a diferença de forma proporcional na próxima fatura.
export async function changePlan(target: string): Promise<{ ok: boolean; message: string }> {
  if (!isPlanId(target)) return { ok: false, message: 'Plano inválido.' };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: 'Sua sessão expirou. Entre de novo.' };

    const { data: subs } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, plan, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const row = subs?.[0];
    if (!row || !ACTIVE_STATUSES.includes(row.status)) return { ok: false, message: 'Não encontramos uma assinatura ativa.' };
    if (row.plan === target) return { ok: true, message: `Você já está no ${PLANS[target].name}.` };

    const price = stripePriceId(target);
    if (!price) return { ok: false, message: 'Esse plano ainda não está disponível.' };

    const sub = await stripe().subscriptions.retrieve(row.stripe_subscription_id as string);
    const item = sub.items.data[0];
    const base: Stripe.SubscriptionUpdateParams = {
      items: [{ id: item.id, price }],
      proration_behavior: 'create_prorations',
      metadata: { ...sub.metadata, plan: target },
    };
    const coupon = foundersCoupon(target);
    try {
      await stripe().subscriptions.update(sub.id, { ...base, discounts: coupon ? [{ coupon }] : '' });
    } catch (err) {
      // Cupom Founders esgotado ou indisponível: segue no preço cheio.
      if (!coupon) throw err;
      await stripe().subscriptions.update(sub.id, { ...base, discounts: '' });
    }

    await syncSubscription(sub.id);
    revalidatePath('/app', 'layout');
    return { ok: true, message: `Pronto! Seu plano agora é o ${PLANS[target].name}.` };
  } catch (err) {
    console.error('[changePlan]', err);
    return { ok: false, message: 'Não foi possível trocar de plano agora. Tente de novo em instantes.' };
  }
}
