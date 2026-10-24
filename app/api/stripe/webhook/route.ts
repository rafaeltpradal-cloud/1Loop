import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { recordExtraPack, sendWelcomeEmail, syncSubscription } from '@/lib/billing';
import { sendPaidConversion } from '@/lib/conversions';
import { createAdminClient } from '@/lib/supabase/admin';

// Virou cliente pagante: teste acabou e a cobrança passou (trialing → active), ou assinou já pagando.
async function reportPaid(sub: Stripe.Subscription, eventTime: number) {
  try {
    const userId = (sub.metadata?.user_id as string | undefined) || null;
    if (!userId) return;
    const invoiceId = typeof sub.latest_invoice === 'string' ? sub.latest_invoice : sub.latest_invoice?.id;
    const invoice = invoiceId ? await stripe().invoices.retrieve(invoiceId) : null;
    const value = invoice ? invoice.amount_paid / 100 : 0;
    const admin = createAdminClient();
    const { data: profile } = await admin.from('profiles').select('phone').eq('id', userId).maybeSingle();
    const { data: auth } = await admin.auth.admin.getUserById(userId);
    await sendPaidConversion({
      eventId: `${sub.id}_pagante`,
      userId,
      email: auth?.user?.email ?? invoice?.customer_email ?? null,
      phone: (profile?.phone as string | undefined) ?? null,
      value,
      plan: (sub.metadata?.plan as string | undefined) ?? null,
      meta: sub.metadata as Record<string, string>,
      time: eventTime,
    });
  } catch (err) {
    console.error('[conversão pagante]', err); // nunca derruba o webhook
  }
}

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
          const row = await syncSubscription(typeof session.subscription === 'string' ? session.subscription : session.subscription.id);
          await sendWelcomeEmail(session, row);
        }
        if (session.mode === 'payment') await recordExtraPack(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub.id);
        const before = (event.data.previous_attributes as { status?: string } | undefined)?.status;
        const becamePaid =
          sub.status === 'active' &&
          ((event.type === 'customer.subscription.updated' && before === 'trialing') || event.type === 'customer.subscription.created');
        if (becamePaid) await reportPaid(sub, event.created);
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
