'use client';

import { useState } from 'react';
import Link from 'next/link';

type Idea = { tipo: string; texto: string };

export function CommentHelper({ preview }: { preview: boolean }) {
  const [post, setPost] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<{ msg: string; paywall?: boolean } | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/comentarios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post, objetivo }) });
      const j = (await r.json().catch(() => ({}))) as { comentarios?: Idea[]; restantes?: number; error?: string; paywall?: boolean };
      if (!r.ok || !j.comentarios) setError({ msg: j.error ?? 'Não deu certo. Tente de novo.', paywall: j.paywall });
      else {
        setIdeas(j.comentarios);
        setLeft(j.restantes ?? null);
      }
    } catch {
      setError({ msg: 'Sem conexão. Tente de novo.' });
    }
    setBusy(false);
  }

  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // sem permissão de copiar: a pessoa seleciona o texto
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form
        className="card storyCard"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="field">
          <label htmlFor="post">Texto do post</label>
          <textarea id="post" rows={7} value={post} onChange={(e) => setPost(e.target.value)} placeholder="Cole aqui o texto do post (abra o post no LinkedIn ou Instagram, copie e cole)." maxLength={4000} />
        </div>
        <div className="field">
          <label htmlFor="obj">Quem é e o que você quer com essa pessoa (opcional)</label>
          <input id="obj" type="text" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Ex.: diretor comercial de uma indústria, quero marcar uma conversa" maxLength={200} />
        </div>
        {error && (
          <div role="alert" className="formError">
            {error.msg} {error.paywall && <Link href="/app/assinar">Assinar e continuar</Link>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn3d" disabled={busy || post.trim().length < 30}>{busy ? 'Pensando nos comentários…' : ideas.length ? 'Sugerir de novo' : 'Sugerir comentários'}</button>
          <span className="muted" style={{ fontSize: 13 }}>{left !== null ? `${left} ${left === 1 ? 'sugestão restante' : 'sugestões restantes'} hoje` : preview ? '3 por dia na prévia' : 'Até 30 por dia'}</span>
        </div>
      </form>

      {ideas.length > 0 && (
        <ol className="commentIdeas" aria-live="polite">
          {ideas.map((c, i) => (
            <li key={i} className="card">
              <span className="eyebrow">{c.tipo}</span>
              <p>{c.texto}</p>
              <button type="button" className="btnGhost btnSm" onClick={() => copy(i, c.texto)}>{copied === i ? 'Copiado ✓' : 'Copiar'}</button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
