'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Visual } from '@/lib/visual';

async function requestBrandVisual(refazer: boolean, pedido = '') {
  const res = await fetch('/api/visual', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'marca', refazer, pedido }) });
  const data = (await res.json().catch(() => ({}))) as { visual?: Visual; atualizados?: number; error?: string };
  return { ok: res.ok && !!data.visual, ...data };
}

/**
 * Conta que ainda não tem a identidade visual: cria uma vez ao abrir Conteúdos (a partir das referências
 * e da entrevista) e passa os rascunhos do bloco de notas padrão para ela.
 */
export function BrandVisualKick() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    try {
      if (sessionStorage.getItem('1loop-visual-kick') === '1') return;
      sessionStorage.setItem('1loop-visual-kick', '1');
    } catch {}
    setState('busy');
    requestBrandVisual(false).then((r) => {
      setState('done');
      if (r.ok) router.refresh();
    });
  }, [router]);
  if (state !== 'busy') return null;
  return (
    <div className="formNote" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="spinner" style={{ width: 16, height: 16 }} />
      Criando o visual da sua marca a partir das suas referências e do seu perfil. Seus posts ganham esse estilo em instantes.
    </div>
  );
}

/** Na tela de referências: refaz a identidade visual depois de subir referências novas. */
export function BrandVisualRefresh({ visual }: { visual: Visual | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pedido, setPedido] = useState('');
  const [msg, setMsg] = useState('');
  async function run() {
    setBusy(true);
    setMsg('');
    const r = await requestBrandVisual(true, pedido);
    setBusy(false);
    if (!r.ok) return setMsg(r.error || 'Não deu para criar agora. Tente de novo em instantes.');
    setMsg(`Pronto: “${r.visual!.nome}”. ${r.atualizados ? `${r.atualizados} ${r.atualizados === 1 ? 'post ainda não publicado foi atualizado' : 'posts ainda não publicados foram atualizados'}.` : ''}`);
    setPedido('');
    router.refresh();
  }
  const v = visual;
  return (
    <section className="card brandVisualCard" aria-labelledby="h-visual">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        {v && (
          <span className="brandSwatches" aria-hidden="true">
            {[v.cores.fundo, v.cores.tinta, v.cores.acento, v.cores.acento2].map((c) => (
              <span key={c} style={{ background: c }} />
            ))}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 id="h-visual" style={{ fontSize: 18 }}>{v ? `Visual da sua marca: ${v.nome}` : 'Visual da sua marca'}</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, margin: '4px 0 0' }}>
            A IA olha as suas referências e a sua entrevista e cria um estilo só seu: cores, letras e layouts. Cada post sai numa variação dele.
          </p>
        </div>
      </div>
      <form
        className="visualAsk"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <input className="input" value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder="Opcional: cores da minha marca, mais sóbrio, mais ousado…" maxLength={300} disabled={busy} />
        <button type="submit" className="btn3d btnSm" disabled={busy}>{busy ? 'Criando…' : v ? 'Refazer com as referências' : 'Criar meu visual'}</button>
      </form>
      {msg && <div className="formNote" role="status">{msg}</div>}
    </section>
  );
}
