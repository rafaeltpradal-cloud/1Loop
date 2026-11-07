import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe, siteUrl } from '@/lib/stripe';
import { foundersCoupon, isPlanId, stripePriceId } from '@/lib/plans';
import { adContextFromRequest } from '@/lib/conversions';
import { freeTrialEnd } from '@/lib/access';
import { eurPriceId, marketOf } from '@/lib/market';
import { CARD_TRIAL_DAYS, trialGroupOf } from '@/lib/trialGroup';

// GET /checkout?plano=pro → cria a sessão de pagamento do Stripe e redireciona.
// O teste de 7 dias é grátis e sem cartão (lib/access.ts): quem assina durante o teste só é cobrado quando ele acaba;
// quem assina depois é cobrado na hora.
// Os dados do cartão são digitados na página do Stripe, nunca passam pelo nosso servidor.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const planRaw = url.searchParams.get('plano');
  const plan = isPlanId(planRaw) ? planRaw : 'pro';

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${siteUrl()}/entrar?next=${encodeURIComponent(`/checkout?plano=${plan}`)}`, { status: 303 });
  }

  // Portugal: preço em euro, sem teste de 7 dias e sem Founders (o teste foi o post publicado).
  const pt = marketOf(user) === 'pt';
  const price = pt ? eurPriceId(plan) : stripePriceId(plan);
  if (!price) {
    return new NextResponse(`Preço do plano "${plan}" não configurado (STRIPE_PRICE_${plan.toUpperCase()}${pt ? '_EUR' : ''}).`, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('name, phone, stripe_customer_id').eq('id', user.id).maybeSingle();

  // Um cliente do Stripe por usuário.
  let customerId = profile?.stripe_customer_id as string | undefined;
  // Cliente criado no ambiente de teste não existe no modo real: cria outro.
  if (customerId) {
    try {
      const c = await stripe().customers.retrieve(customerId);
      if ((c as { deleted?: boolean }).deleted) customerId = undefined;
    } catch {
      customerId = undefined;
    }
  }
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      name: profile?.name ?? undefined,
      phone: profile?.phone && !pt ? `+55${profile.phone}` : undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const coupon = pt ? undefined : foundersCoupon(plan);
  // O Stripe exige o fim do teste pelo menos 48 h à frente; com menos que isso, a cobrança é na hora.
  const ftEnd = freeTrialEnd(user).getTime();
  // Grupo do cartão (teste A/B): os 7 dias grátis começam agora, com o cartão cadastrado.
  // Só para quem nunca teve assinatura (quem cancelou não ganha outro teste).
  const { count: hadSub } = await admin.from('subscriptions').select('user_id', { count: 'exact', head: true }).eq('user_id', user.id);
  const cardTrial = !pt && trialGroupOf(user) === 'cartao' && !hadSub;
  const trial = cardTrial
    ? { trial_period_days: CARD_TRIAL_DAYS }
    : !pt && ftEnd - Date.now() > 49 * 3600000 ? { trial_end: Math.floor(ftEnd / 1000) } : {};
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price, quantity: 1 }],
    payment_method_collection: 'always',
    subscription_data: {
      ...trial,
      // trk_*: ids de anúncio (cookies _fbp/_fbc/_ga, IP e navegador) para atribuir a cobrança ao anúncio.
      metadata: { user_id: user.id, plan, ...(pt ? { market: 'pt' } : {}), ...adContextFromRequest(request) },
    },
    ...(coupon ? { discounts: [{ coupon }] } : { allow_promotion_codes: true }),
    locale: pt ? 'pt' : 'pt-BR',
    success_url: `${siteUrl()}/bem-vindo?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/planos`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
