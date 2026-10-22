import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { syncSubscription } from '@/lib/billing';

export const runtime = 'nodejs';

// Configure no Stripe (Developers > Webhooks) apontando para /api/stripe/webhook
// com os eventos: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated e customer.subscription.deleted.
export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature');
  // Aceita também o nome salvo sem o "T" final na Vercel.
  const secret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRE;
  if (!signature || !secret) return new NextResponse('Webhook não configurado', { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new NextResponse('Assinatura do webhook inválida', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          await syncSubscription(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub.id);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('[stripe webhook]', err);
    return new NextResponse('Erro ao processar o evento', { status: 500 });
  }

  return NextResponse.json({ received: true });
}
