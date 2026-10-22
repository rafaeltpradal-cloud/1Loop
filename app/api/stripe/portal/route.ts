import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, siteUrl } from '@/lib/stripe';

// Abre o portal do Stripe, onde o cliente troca o cartão, muda de plano ou cancela.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar`, { status: 303 });

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).maybeSingle();
  if (!profile?.stripe_customer_id) return NextResponse.redirect(`${siteUrl()}/planos`, { status: 303 });

  const portal = await stripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${siteUrl()}/app/conta`,
    locale: 'pt-BR',
  });
  return NextResponse.redirect(portal.url, { status: 303 });
}
