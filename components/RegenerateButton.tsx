'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Gera outra versão da estratégia, dentro do limite do mês. */
export function RegenerateButton({ left, max, month, nextMonth }: { left: number; max: number; month: string; nextMonth: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const out = left <= 0;

  async function run() {
    setBusy(true);
    setError('');
    setConfirm(false);
    const res = await fetch('/api/estrategia', { method: 'POST' });
    setBusy(false);
    if (res.ok) return router.refresh();
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setError(json.error || 'Não deu certo. Tente de novo.');
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {error && <span role="alert" style={{ fontSize: 13, color: 'var(--error-ink)', fontWeight: 600, maxWidth: 380 }}>{error}</span>}
      {confirm ? (
        <span className="redoConfirm">
          <span className="muted" style={{ fontSize: 13 }}>
            Gera uma estratégia nova do zero e usa {max - left + 1} de {max} de {month}. O calendário atual sai de cena.
          </span>
          <button className="btnGhost btnSm" type="button" onClick={run} disabled={busy}>Gerar</button>
          <button className="linkBtn" type="button" style={{ fontSize: 13 }} onClick={() => setConfirm(false)}>Cancelar</button>
        </span>
      ) : (
        <button
          className="btnGhost btnSm"
          type="button"
          onClick={() => setConfirm(true)}
          disabled={busy || out}
          title={out ? `Novas versões voltam em 1º de ${nextMonth}` : `${left} de ${max} versões restantes em ${month}`}
        >
          {busy ? 'Gerando…' : out ? `Sem versões até 1º de ${nextMonth}` : `Gerar outra versão (${left})`}
        </button>
      )}
    </div>
  );
}
