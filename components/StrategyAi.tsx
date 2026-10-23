'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiAsk, type AiReply } from '@/components/AiAsk';

type Res = { ok?: boolean; resposta?: string; left?: number; canUndo?: boolean; postsAfetados?: number; error?: string };

/** "Peça à IA" na página da estratégia: ajusta a estratégia salva e deixa desfazer o último ajuste. */
export function StrategyAi({ left, max, canUndo }: { left: number; max: number; canUndo: boolean }) {
  const router = useRouter();
  const [undo, setUndo] = useState(canUndo);
  const [afetados, setAfetados] = useState(0);
  const [undoing, setUndoing] = useState(false);
  const [undone, setUndone] = useState(false);

  async function call(body: object): Promise<Res & { status: number }> {
    const res = await fetch('/api/estrategia/ajustar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ...((await res.json().catch(() => ({}))) as Res), status: res.status };
  }

  async function ask(pedido: string): Promise<AiReply> {
    const r = await call({ pedido });
    if (!r.ok) return { ok: false, error: r.error || 'A IA não conseguiu ajustar agora.' };
    setUndo(true);
    setUndone(false);
    setAfetados(r.postsAfetados ?? 0);
    router.refresh();
    return { ok: true, resposta: r.resposta ?? 'Pronto, ajustei a estratégia.', left: r.left };
  }

  async function revert() {
    setUndoing(true);
    const r = await call({ desfazer: true });
    setUndoing(false);
    if (r.ok) {
      setUndo(false);
      setUndone(true);
      router.refresh();
    }
  }

  return (
    <AiAsk
      title="Peça à IA para ajustar a estratégia"
      hint="Mude pilares, calendário, formatos, redes ou o plano de ação. O resto continua como está."
      placeholder="Ex.: quero mais Reels e menos carrossel, e um post de lançamento no dia 15"
      suggestions={['Mais vídeos e menos carrossel', 'Inclua um pilar sobre bastidores', 'Foque mais em vendas na última semana', 'Troque os temas da semana 2']}
      left={left}
      max={max}
      busyLabel="A IA está ajustando a estratégia… leva uns 30 segundos."
      onAsk={ask}
    >
      <span className="aiAskActs">
        {undo && (
          <button type="button" className="btnGhost btnSm" onClick={revert} disabled={undoing}>
            {undoing ? 'Desfazendo…' : 'Desfazer ajuste'}
          </button>
        )}
        {undone && <span style={{ fontSize: 13 }}>Voltou para a versão anterior ✓</span>}
        {afetados > 0 && !undone && (
          <span style={{ fontSize: 12, fontWeight: 500, flexBasis: '100%' }}>
            {afetados === 1 ? '1 conteúdo já gerado' : `${afetados} conteúdos já gerados`} de dias que mudaram continuam com o texto antigo. Abra em Conteúdos e use “Refazer com IA”.
          </span>
        )}
      </span>
    </AiAsk>
  );
}
