'use client';

import { useEffect, useState } from 'react';
import { saveWhatsapp } from '@/app/app/whatsapp/actions';

function mask(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/** Pede o WhatsApp a quem já tem post pronto: o time chama para ajudar a publicar o primeiro. */
export function WhatsAppAsk() {
  const [v, setV] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'hide'>('idle');
  useEffect(() => {
    try {
      if (localStorage.getItem('1loop-wa-ask') === 'hide') setState('hide');
    } catch {}
  }, []);
  const [err, setErr] = useState('');
  if (state === 'hide') return null;
  if (state === 'ok')
    return (
      <div className="formNote" role="status">Pronto! A gente te chama no WhatsApp para te ajudar com o primeiro post.</div>
    );
  return (
    <form
      className="card waAsk"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr('');
        setState('busy');
        const r = await saveWhatsapp(v);
        if (!r.ok) {
          setErr(r.error);
          setState('idle');
          return;
        }
        setState('ok');
      }}
    >
      <div style={{ flex: '1 1 240px' }}>
        <b>Quer ajuda para publicar o primeiro post?</b>
        <span className="muted" style={{ display: 'block', fontSize: 14, lineHeight: 1.5 }}>Deixe seu WhatsApp e alguém do time 1loop te chama para tirar dúvidas. Sem spam.</span>
      </div>
      <input className="input" inputMode="tel" autoComplete="tel-national" placeholder="(11) 91234-5678" value={v} onChange={(e) => setV(mask(e.target.value))} aria-label="Seu WhatsApp" style={{ maxWidth: 200 }} />
      <button type="submit" className="btn3d btnSm" disabled={state === 'busy' || v.replace(/\D/g, '').length < 10}>{state === 'busy' ? 'Salvando…' : 'Quero ajuda'}</button>
      <button
        type="button"
        className="linkBtn"
        style={{ fontSize: 13 }}
        onClick={() => {
          try {
            localStorage.setItem('1loop-wa-ask', 'hide');
          } catch {}
          setState('hide');
        }}
      >
        Agora não
      </button>
      {err && <div role="alert" className="formError" style={{ flexBasis: '100%' }}>{err}</div>}
    </form>
  );
}
