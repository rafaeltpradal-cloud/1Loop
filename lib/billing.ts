import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { EXTRA_PACK, PLANS, planFromPriceId, type PlanId } from '@/lib/plans';
import { stripe, siteUrl } from '@/lib/stripe';
import { sendEmail } from '@/lib/email';
import { welcomeEmail } from '@/lib/emails/welcome';

export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan: PlanId | null;
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

const toIso = (s?: number | null) => (s ? new Date(s * 1000).toISOString() : null);

// Estados em que o usuário pode usar o app.
export const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

// Copia o estado de uma assinatura do Stripe para a tabela `subscriptions`.
// Usado pelo webhook e no retorno do checkout (caso o webhook ainda não tenha chegado).
export async function syncSubscription(subscriptionId: string) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const admin = createAdminClient();
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  let userId = (sub.metadata?.user_id as string | undefined) || null;
  if (!userId) {
    const { data } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
    userId = data?.id ?? null;
  }
  if (!userId) throw new Error(`Assinatura ${sub.id} sem usuário vinculado.`);

  const item = sub.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number };
  const legacyPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

  const row: SubscriptionRow = {
    user_id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    plan: planFromPriceId(item?.price?.id) ?? ((sub.metadata?.plan as PlanId | undefined) || null),
    status: sub.status,
    trial_end: toIso(sub.trial_end),
    current_period_end: toIso(item?.current_period_end ?? legacyPeriodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
  };

  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
  if (error) throw error;
  return row;
}

// Registra a compra de um pacote extra de posts (pagamento único).
// Chamado pelo webhook e no retorno do pagamento; gravar duas vezes não duplica.
export async function recordExtraPack(session: Stripe.Checkout.Session) {
  if (session.mode !== 'payment' || session.metadata?.kind !== 'extra_pack' || session.payment_status !== 'paid') return false;
  const userId = session.metadata?.user_id || session.client_reference_id;
  if (!userId) return false;
  const admin = createAdminClient();
  const { error } = await admin.from('extra_packs').upsert(
    {
      user_id: userId,
      posts: Number(session.metadata?.posts) || EXTRA_PACK.posts,
      amount: session.amount_total ?? 0,
      stripe_session_id: session.id,
    },
    { onConflict: 'stripe_session_id', ignoreDuplicates: true },
  );
  if (error) throw error;
  return true;
}

// E-mail de confirmação da assinatura (enviado uma vez, quando o checkout é concluído).
export async function sendWelcomeEmail(session: Stripe.Checkout.Session, row: SubscriptionRow) {
  try {
    const email = session.customer_details?.email || session.customer_email;
    if (!email || !row.plan) return;
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('name').eq('id', row.user_id).maybeSingle();
    const name = (profile?.name as string | undefined) || email.split('@')[0];
    const plan = PLANS[row.plan];

    // Valor real da próxima cobrança (já com o desconto Founders, se houver).
    let amount = plan.priceFounders ?? plan.priceFull;
    try {
      const preview = await stripe().invoices.createPreview({ subscription: row.stripe_subscription_id });
      if (typeof preview.amount_due === 'number' && preview.amount_due > 0) amount = preview.amount_due / 100;
    } catch {
      // Sem prévia: usa o preço da tabela.
    }

    const msg = welcomeEmail({
      firstName: name.split(' ')[0],
      planName: plan.name,
      rhythm: plan.rhythm,
      amount,
      trialEnd: row.status === 'trialing' && row.trial_end ? new Date(row.trial_end) : null,
      appUrl: siteUrl(),
    });
    await sendEmail({ to: email, ...msg });
  } catch (err) {
    console.error('[welcome email]', err);
  }
}
