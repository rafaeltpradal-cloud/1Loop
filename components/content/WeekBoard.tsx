'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NetworkIcon } from '@/components/NetworkIcon';
import { networkByName } from '@/lib/networks';
import { addDays, formatShort, fromISO } from '@/lib/dates';
import type { PostRow } from '@/lib/contentTypes';

export type BoardItem = {
  index: number;
  date: string;
  rede: string;
  formato: string;
  tema: string;
  objetivo: string;
  comRosto: boolean;
  pilar: string;
  post: PostRow | null;
};

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const STATUS_LABEL: Record<PostRow['status'], string> = {
  rascunho: 'Para revisar',
  aprovado: 'Aprovado',
  agendado: 'Agendado',
  publicando: 'Publicando',
  publicado: 'Publicado',
  erro: 'Erro ao publicar',
};

export function StatusPill({ status }: { status: PostRow['status'] }) {
  return <span className={`statusPill ${status}`}>{STATUS_LABEL[status]}</span>;
}

export type Quota = { used: number; max: number; extras: number; month: string; nextMonth: string };

export function WeekBoard({ items, today, planStart, quota }: { items: BoardItem[]; today: string; planStart: string; quota: Quota }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Record<number, PostRow | null>>(() => Object.fromEntries(items.map((i) => [i.index, i.post])));
  const [anchor, setAnchor] = useState(() => (today < planStart ? planStart : today));
  const [running, setRunning] = useState<number | null>(null);
  const [queue, setQueue] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [gen, setGen] = useState(0); // posts novos gerados nesta tela
  const baseLeft0 = Math.max(0, quota.max - quota.used);
  const baseUsed = Math.min(quota.max, quota.used + Math.min(gen, baseLeft0));
  const extrasLeft = Math.max(0, quota.extras - Math.max(0, gen - baseLeft0));
  const left = quota.max - baseUsed + extrasLeft;

  const end = addDays(anchor, 6);
  const week = useMemo(() => items.filter((i) => i.date >= anchor && i.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index), [items, anchor, end]);
  const missing = week.filter((i) => !posts[i.index]);
  const counts = week.reduce(
    (acc, i) => {
      const p = posts[i.index];
      if (p) acc[p.status === 'erro' ? 'rascunho' : p.status === 'publicando' ? 'agendado' : p.status] += 1;
      return acc;
    },
    { rascunho: 0, aprovado: 0, agendado: 0, publicado: 0 },
  );

  async function generate(index: number) {
    setRunning(index);
    setErrors((e) => ({ ...e, [index]: '' }));
    try {
      const res = await fetch('/api/conteudos/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index }) });
      const json = (await res.json().catch(() => ({}))) as { post?: PostRow; error?: string };
      if (!res.ok || !json.post) throw new Error(json.error || 'Não deu para gerar agora.');
      const isNew = !posts[index];
      setPosts((p) => ({ ...p, [index]: json.post! }));
      if (isNew) setGen((g) => g + 1);
      return true;
    } catch (err) {
      setErrors((e) => ({ ...e, [index]: err instanceof Error ? err.message : 'Não deu para gerar agora.' }));
      return false;
    } finally {
      setRunning(null);
    }
  }

  async function generateWeek() {
    const list = missing.map((i) => i.index).slice(0, Math.max(0, left));
    setQueue({ done: 0, total: list.length });
    for (let k = 0; k < list.length; k++) {
      await generate(list[k]);
      setQueue({ done: k + 1, total: list.length });
    }
    setQueue(null);
    router.refresh();
  }

  const busy = running !== null;
  const label = `${formatShort(anchor)} a ${formatShort(end)}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="card weekBar">
        <div className="calNav">
          <button type="button" className="calIconBtn" onClick={() => setAnchor(addDays(anchor, -7))} aria-label="Semana anterior" disabled={busy}>‹</button>
          <span className="calMonth" style={{ textTransform: 'none' }} aria-live="polite">{label}</span>
          <button type="button" className="calIconBtn" onClick={() => setAnchor(addDays(anchor, 7))} aria-label="Próxima semana" disabled={busy}>›</button>
          <button type="button" className="calTodayBtn" onClick={() => setAnchor(today < planStart ? planStart : today)} disabled={busy}>Esta semana</button>
        </div>
        <div className="weekStats">
          <span><b>{week.length}</b> {week.length === 1 ? 'post' : 'posts'}</span>
          <span><b>{counts.rascunho}</b> para revisar</span>
          <span><b>{counts.aprovado}</b> {counts.aprovado === 1 ? 'aprovado' : 'aprovados'}</span>
          {counts.agendado > 0 && <span><b>{counts.agendado}</b> {counts.agendado === 1 ? 'agendado' : 'agendados'}</span>}
          <span><b>{counts.publicado}</b> {counts.publicado === 1 ? 'publicado' : 'publicados'}</span>
        </div>
        {missing.length > 0 && left <= 0 ? (
          <Link className="btnGhost btnSm" href="/app/plano">Posts de {quota.month} esgotados · ver pacote</Link>
        ) : missing.length > 0 ? (
          <button type="button" className="btn3d weekGenerate" onClick={generateWeek} disabled={busy}>
            {queue
              ? `Gerando ${Math.min(queue.done + 1, queue.total)} de ${queue.total}…`
              : `Gerar ${Math.min(missing.length, left)} ${Math.min(missing.length, left) === 1 ? 'conteúdo' : 'conteúdos'} da semana`}
          </button>
        ) : (
          week.length > 0 && <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Semana com todos os conteúdos prontos.</span>
        )}
      </div>

      <div className="quotaLine" role="status">
        <span>
          Posts novos em {quota.month}: <b>{baseUsed}</b> de {quota.max}
          {quota.extras > 0 && ` · ${extrasLeft} ${extrasLeft === 1 ? 'extra' : 'extras'} de pacote`}
        </span>
        {left <= 0 ? (
          <span>
            Acabou a cota do mês. <Link href="/app/plano">Comprar +5 posts</Link> ou espere 1º de {quota.nextMonth}.
          </span>
        ) : missing.length > left ? (
          <span>Dá para gerar mais {left} {left === 1 ? 'post' : 'posts'} este mês.</span>
        ) : null}
      </div>

      {queue && (
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${Math.max(6, (queue.done / Math.max(queue.total, 1)) * 100)}%` }} />
        </div>
      )}

      {week.length === 0 ? (
        <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b style={{ fontSize: 16 }}>Nenhum post do seu plano nesta semana.</b>
          <span className="muted" style={{ fontSize: 14 }}>Use as setas para ver outras semanas ou ajuste os dias no calendário da estratégia.</span>
          <div><Link className="btnGhost btnSm" href="/app/estrategia">Abrir o calendário</Link></div>
        </div>
      ) : (
        <ol className="postList">
          {week.map((i) => {
            const p = posts[i.index];
            const net = networkByName(i.rede);
            const d = fromISO(i.date);
            const isRunning = running === i.index;
            return (
              <li key={i.index} className={p ? 'postRow' : 'postRow empty'}>
                <div className="postDate">
                  <span>{WD[d.getDay()]}</span>
                  <b>{d.getDate()}</b>
                </div>
                <div className="postMain">
                  <div className="postMeta">
                    {net && <NetworkIcon id={net.id} size={22} />}
                    <span>{i.rede}</span>
                    <span className="sep">·</span>
                    <span>{i.formato}</span>
                    <span className="sep">·</span>
                    <span>{i.comRosto ? 'com rosto' : 'sem rosto'}</span>
                    {p && <StatusPill status={p.status} />}
                  </div>
                  <b className="postTitle">{p ? p.content.gancho : i.tema}</b>
                  <span className="muted postSub">
                    {p?.status === 'agendado' && p.scheduled_at
                      ? `Sai às ${new Date(p.scheduled_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })} · ${i.tema}`
                      : p?.status === 'erro' && p.publish_error
                        ? p.publish_error
                        : p
                          ? i.tema
                          : `${i.pilar} · objetivo: ${i.objetivo}`}
                  </span>
                  {errors[i.index] && <span role="alert" className="postErr">{errors[i.index]}</span>}
                </div>
                <div className="postAct">
                  {p ? (
                    <Link className="btnGhost btnSm" href={`/app/conteudos/${p.id}`}>Abrir</Link>
                  ) : (
                    <button type="button" className="btnGhost btnSm" onClick={() => generate(i.index).then((ok) => ok && router.refresh())} disabled={busy || left <= 0} title={left <= 0 ? `Posts de ${quota.month} esgotados` : undefined}>
                      {isRunning ? 'Gerando…' : 'Gerar'}
                    </button>
                  )}
                </div>
                {isRunning && <span className="postLoading" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      )}
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
        Cada conteúdo leva uns 20 segundos para ficar pronto. A publicação automática nas redes chega em breve; por enquanto, você copia o texto, baixa as imagens e publica em poucos toques.
      </p>
    </div>
  );
}
