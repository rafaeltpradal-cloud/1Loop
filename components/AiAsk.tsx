'use client';

import { useRef, useState } from 'react';

export type AiReply = { ok: true; resposta: string; left?: number } | { ok: false; error: string };

/** Barra "Peça à IA": a pessoa escreve o ajuste que quer e a IA aplica. */
export function AiAsk({
  title,
  hint,
  placeholder,
  suggestions,
  left,
  max,
  busyLabel = 'A IA está ajustando…',
  onAsk,
  children,
}: {
  title: string;
  hint: string;
  placeholder: string;
  suggestions: string[];
  left: number;
  max: number;
  busyLabel?: string;
  onAsk: (pedido: string) => Promise<AiReply>;
  /** Ações que aparecem junto da resposta (ex.: salvar, desfazer). */
  children?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<AiReply | null>(null);
  const [remaining, setRemaining] = useState(left);
  const box = useRef<HTMLTextAreaElement>(null);

  async function send(pedido = text) {
    const p = pedido.trim();
    if (p.length < 3 || busy) return;
    setBusy(true);
    setReply(null);
    try {
      const r = await onAsk(p);
      setReply(r);
      if (r.ok) {
        setText('');
        if (typeof r.left === 'number') setRemaining(r.left);
      }
    } catch {
      setReply({ ok: false, error: 'Não deu certo agora. Tente de novo.' });
    } finally {
      setBusy(false);
    }
  }

  const out = remaining <= 0;

  return (
    <section className="aiAsk" aria-label={title}>
      <div className="aiAskHead">
        <span className="aiAskIcon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2zm6.5 11l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6zM6 15l.7 2 2 .7-2 .7L6 20.5l-.7-2.1-2-.7 2-.7L6 15z" />
          </svg>
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <b style={{ fontSize: 15 }}>{title}</b>
          <span className="muted" style={{ fontSize: 13 }}>{hint}</span>
        </div>
        <span className="aiAskCount" title="Pedidos de ajuste que ainda dá para fazer">
          {Math.max(0, remaining)}/{max}
        </span>
      </div>

      <form
        className="aiAskForm"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={out ? 'Você já usou todos os pedidos de ajuste aqui.' : placeholder}
          rows={2}
          maxLength={1000}
          disabled={busy || out}
          aria-label={title}
        />
        <button type="submit" className="btn3d btnSm aiAskSend" disabled={busy || out || text.trim().length < 3}>
          {busy ? 'Ajustando…' : 'Pedir à IA'}
        </button>
      </form>

      {!busy && !reply && !out && (
        <div className="aiAskChips">
          {suggestions.slice(0, 3).map((s) => (
            <button key={s} type="button" className="aiChip" onClick={() => (setText(s), box.current?.focus())}>
              {s}
            </button>
          ))}
        </div>
      )}

      {busy && (
        <div className="aiAskReply busy" role="status">
          <span className="spinner sm" aria-hidden="true" />
          {busyLabel}
        </div>
      )}
      {reply && !busy && (
        <div className={reply.ok ? 'aiAskReply' : 'aiAskReply err'} role={reply.ok ? 'status' : 'alert'}>
          <span>{reply.ok ? reply.resposta : reply.error}</span>
          {reply.ok && children}
        </div>
      )}
    </section>
  );
}
