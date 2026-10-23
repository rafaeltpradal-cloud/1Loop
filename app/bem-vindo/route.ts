import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, siteUrl } from '@/lib/stripe';
import { syncSubscription } from '@/lib/billing';

// Retorno do checkout. Garante que a assinatura já está salva (mesmo se o webhook atrasar)
// e leva o usuário direto para o primeiro passo: a entrevista.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar`, { status: 303 });

  if (sessionId) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sessionId);
      if (session.client_reference_id === user.id && session.subscription) {
        await syncSubscription(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
      }
    } catch (err) {
      console.error('[bem-vindo]', err);
    }
  }
  return NextResponse.redirect(`${siteUrl()}/app/entrevista?bemvindo=1&assinou=${sessionId ? '1' : '0'}`, { status: 303 });
}
