import Stripe from 'stripe';

let client: Stripe | null = null;

export function stripe() {
  // A chave do modo real foi salva como STRIPE_SECRET_KEY_NEW; ela tem prioridade.
  const key = (process.env.STRIPE_SECRET_KEY_NEW || process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY não configurada. Veja o README.');
  }
  if (!client) client = new Stripe(key);
  return client;
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
