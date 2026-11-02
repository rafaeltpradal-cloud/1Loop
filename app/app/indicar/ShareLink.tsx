'use client';

import { useState } from 'react';

export function ShareLink({ link, firstName }: { link: string; firstName: string }) {
  const [copied, setCopied] = useState(false);
  const msg = `Estou usando o 1loop para postar no LinkedIn sem perder tempo: ele monta a estratégia e escreve os posts na minha voz. Dá para testar grátis, sem cartão: ${link}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // sem permissão: o link está visível para selecionar
    }
  }
  return (
    <section className="card refShare" aria-label="Seu link">
      <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Seu link, {firstName}</span>
      <div className="refLink">
        <input className="input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Seu link de indicação" />
        <button type="button" className="btn3d btnSm" onClick={copy}>{copied ? 'Copiado ✓' : 'Copiar'}</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a className="btnGhost btnSm" href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>
        <a className="btnGhost btnSm" href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">Compartilhar no LinkedIn</a>
        <a className="btnGhost btnSm" href={`mailto:?subject=${encodeURIComponent('Uma ferramenta para postar no LinkedIn')}&body=${encodeURIComponent(msg)}`}>Mandar por e-mail</a>
      </div>
    </section>
  );
}
