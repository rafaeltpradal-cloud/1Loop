'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RegenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function run() {
    setBusy(true);
    setError(false);
    const res = await fetch('/api/estrategia', { method: 'POST' });
    setBusy(false);
    if (res.ok) router.refresh();
    else setError(true);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {error && <span role="alert" style={{ fontSize: 13, color: '#9B1C2C', fontWeight: 600 }}>Não deu certo. Tente de novo.</span>}
      <button className="btnGhost btnSm" type="button" onClick={run} disabled={busy}>{busy ? 'Gerando…' : 'Gerar outra versão'}</button>
    </div>
  );
}
