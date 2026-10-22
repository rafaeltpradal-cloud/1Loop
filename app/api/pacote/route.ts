import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { stripe, siteUrl } from '@/lib/stripe';
import { EXTRA_PACK } from '@/lib/plans';

// POST /api/pacote → pagamento único do pacote extra de posts, na página segura do Stripe.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/plano`, { status: 303 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
  const customer = profile?.stripe_customer_id as string | undefined;
  if (!customer) return NextResponse.redirect(`${siteUrl()}/planos`, { status: 303 });

  const metadata = { kind: 'extra_pack', user_id: user.id, posts: String(EXTRA_PACK.posts) };
  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer,
    client_reference_id: user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'brl',
          unit_amount: EXTRA_PACK.price * 100,
          product_data: {
            name: `1loop creators · Pacote extra de ${EXTRA_PACK.posts} posts`,
            description: 'Pagamento único. Os posts extras somam ao seu plano.',
          },
        },
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    locale: 'pt-BR',
    success_url: `${siteUrl()}/app/plano?pacote={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/app/plano`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
