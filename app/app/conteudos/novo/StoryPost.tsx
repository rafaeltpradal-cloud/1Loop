'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VoiceButton } from '@/components/VoiceButton';
import { fromISO } from '@/lib/dates';

export type Slot = { index: number; date: string; rede: string; formato: string; tema: string };

const label = (iso: string) => fromISO(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');

const IDEIAS = ['Uma objeção que ouvi esta semana e como respondi', 'Um erro que cometi com um cliente e o que aprendi', 'Uma venda que quase perdi', 'Uma pergunta que meu cliente sempre faz'];

export function StoryPost({ slots }: { slots: Slot[]; preview: boolean }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [slot, setSlot] = useState<number | null>(slots[0]?.index ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; paywall?: boolean } | null>(null);

  async function submit() {
    if (slot === null) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/conteudos/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: slot, historia: text }) });
      const j = (await r.json().catch(() => ({}))) as { post?: { id: number }; error?: string; paywall?: boolean };
      if (!r.ok || !j.post) {
        setError({ msg: j.error ?? 'Não deu para gerar agora. Tente de novo.', paywall: j.paywall });
        setBusy(false);
        return;
      }
      router.push(`/app/conteudos/${j.post.id}`);
    } catch {
      setError({ msg: 'Sem conexão. Tente de novo.' });
      setBusy(false);
    }
  }

  if (slots.length === 0)
    return (
      <div className="card" style={{ padding: 24, boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <b>Todos os dias do seu calendário já têm post.</b>
        <span className="muted" style={{ fontSize: 14 }}>Abra um post ainda não publicado e use “Peça à IA” para contar a história nele.</span>
        <div><Link className="btnGhost btnSm" href="/app/conteudos">Ver conteúdos</Link></div>
      </div>
    );

  return (
    <form
      className="card storyCard"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="field">
        <label htmlFor="historia">O que aconteceu?</label>
        <textarea id="historia" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Hoje um cliente disse que ia pensar. Em vez de mandar proposta, perguntei o que ele precisava ver para decidir…" maxLength={2500} />
        <div className="storyTools">
          <VoiceButton value={text} onChange={setText} />
          <span className="muted" style={{ fontSize: 12 }}>{text.length}/2500</span>
        </div>
      </div>
      {!text && (
        <div className="storyIdeas" aria-label="Ideias">
          {IDEIAS.map((i) => (
            <button key={i} type="button" className="chip" onClick={() => setText(`${i}: `)}>{i}</button>
          ))}
        </div>
      )}
      <fieldset className="storySlots">
        <legend>Em qual dia vai sair</legend>
        {slots.map((s) => (
          <label key={s.index} className={slot === s.index ? 'on' : ''}>
            <input type="radio" name="slot" checked={slot === s.index} onChange={() => setSlot(s.index)} />
            <b>{label(s.date)}</b>
            <span className="muted">{s.rede} · {s.formato}</span>
          </label>
        ))}
      </fieldset>
      {error && (
        <div role="alert" className="formError">
          {error.msg} {error.paywall && <Link href="/app/assinar">Assinar e continuar</Link>}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="submit" className="btn3d" disabled={busy || text.trim().length < 20 || slot === null}>{busy ? 'Escrevendo seu post…' : 'Transformar em post'}</button>
        <span className="muted" style={{ fontSize: 13 }}>Conta como um post do mês.</span>
      </div>
    </form>
  );
}
