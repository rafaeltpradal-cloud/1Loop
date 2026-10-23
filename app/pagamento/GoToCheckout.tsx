'use client';

import { useEffect } from 'react';
import { track } from '@/components/Tracking';

export function GoToCheckout({ plan, value }: { plan: string; value: number }) {
  useEffect(() => {
    const params = { plan, value, currency: 'BRL' };
    track({ ga: 'sign_up', meta: 'CompleteRegistration', params });
    track({ ga: 'begin_checkout', meta: 'InitiateCheckout', params });
    // Dá tempo de os eventos saírem antes de ir para o Stripe.
    const t = setTimeout(() => window.location.replace(`/checkout?plano=${encodeURIComponent(plan)}`), 700);
    return () => clearTimeout(t);
  }, [plan, value]);

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <span className="spinner" aria-hidden="true" />
        <p className="muted" style={{ fontSize: 14 }}>Indo para o pagamento seguro…</p>
        <a className="linkBtn" href={`/checkout?plano=${encodeURIComponent(plan)}`}>Continuar</a>
      </div>
    </main>
  );
}
