'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PLANS, PLAN_ORDER, brl, type PlanId } from '@/lib/plans';
import { changePlan } from './actions';
import { priceNow } from '@/lib/founders';

export function PlanCards({ current, trialing }: { current: PlanId; trialing: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<PlanId | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const curIdx = PLAN_ORDER.indexOf(current);

  function confirm(target: PlanId) {
    setResult(null);
    start(async () => {
      const res = await changePlan(target);
      setResult(res);
      setConfirming(null);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {result && <div className={result.ok ? 'formOk' : 'formError'} role="status">{result.message}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {PLAN_ORDER.map((id, i) => {
          const p = PLANS[id];
          const isCurrent = id === current;
          const upgrade = i > curIdx;
          const price = priceNow(id);
          const founders = price !== p.priceFull;
          return (
            <div
              key={id}
              className="card"
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: 'none',
                ...(isCurrent ? { borderColor: 'var(--violet)', boxShadow: '0 0 0 1px var(--violet)' } : {}),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minHeight: 26 }}>
                <b style={{ fontSize: 20 }}>{p.name}</b>
                {isCurrent && <span className="pill" style={{ minHeight: 26, fontSize: 11, color: 'var(--violet)' }}>Seu plano</span>}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>{p.tagline}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                {founders && <s style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted-2)' }}>{brl(p.priceFull)}</s>}
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>{brl(price)}</span>
                <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>/mês</span>
              </div>
              <div className="panel" style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13 }}>{p.rhythm}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                {p.features.map((f) => (
                  <li key={f} style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--teal)', fontWeight: 800 }}>✓</span>{f}</li>
                ))}
              </ul>
              <div style={{ flex: 1 }} />
              {isCurrent ? (
                <div className="muted" style={{ fontSize: 13, fontWeight: 600, minHeight: 32, display: 'flex', alignItems: 'center' }}>Plano atual</div>
              ) : confirming === id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>
                    Mudar para o {p.name} por {brl(price)}/mês?{' '}
                    {trialing ? 'Você continua no período de teste, sem cobrança agora.' : 'A diferença é ajustada de forma proporcional na próxima fatura.'}
                  </p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button type="button" className="btn3d btnSm" onClick={() => confirm(id)} disabled={pending}>{pending ? 'Trocando…' : 'Confirmar'}</button>
                    <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => setConfirming(null)} disabled={pending}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={upgrade ? 'btn3d btnSm' : 'btnGhost btnSm'} onClick={() => { setResult(null); setConfirming(id); }}>
                  {upgrade ? `Fazer upgrade para o ${p.name}` : `Mudar para o ${p.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
