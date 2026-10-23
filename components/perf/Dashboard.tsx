'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { refreshMetrics } from '@/app/app/desempenho/actions';
import { ColumnChart, LineChart, NET_COLOR, NET_NAME, fmt, fmtFull } from '@/components/perf/Charts';
import { interactionsOf, type Metrics } from '@/lib/metricsShared';

export type PerfPost = {
  id: number;
  network: string;
  permalink: string | null;
  caption: string | null;
  media_type: string | null;
  posted_at: string | null;
  metrics: Metrics;
  post_id: number | null;
  source: 'api' | 'manual';
};
export type PerfDay = { day: string; followers: number | null; reach: number | null };
export type IgStatus = 'ok' | 'sem_conexao' | 'sem_permissao';

const PERIODS = [7, 30, 90] as const;
const TYPE: Record<string, string> = { REELS: 'Reels', IMAGE: 'Imagem', CAROUSEL_ALBUM: 'Carrossel', VIDEO: 'Vídeo' };
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const dShort = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '');
const seen = (m: Metrics) => m.views ?? m.impressions ?? 0;
const rate = (m: Metrics) => {
  const base = m.reach ?? m.impressions ?? 0;
  return base > 0 ? interactionsOf(m) / base : null;
};
const num = (v: number | undefined) => (typeof v === 'number' ? fmtFull(v) : '—');
const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`);

function Tile({ label, value, delta, hint }: { label: string; value: string; delta?: string | null; hint?: string }) {
  return (
    <div className="statTile">
      <span className="statLabel">{label}</span>
      <span className="statValue">{value}</span>
      <span className="statMeta">{delta ?? hint ?? ' '}</span>
    </div>
  );
}

export function PerformanceDashboard({ posts, days, ig, updatedAt }: { posts: PerfPost[]; days: PerfDay[]; ig: IgStatus; updatedAt: string | null }) {
  const router = useRouter();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(30);
  const [net, setNet] = useState<'todas' | 'instagram' | 'linkedin'>('todas');
  const [sort, setSort] = useState<'recentes' | 'interacoes' | 'alcance'>('recentes');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const since = isoDaysAgo(period);
  const inPeriod = useMemo(
    () => posts.filter((p) => (p.posted_at ?? '') >= since && (net === 'todas' || p.network === net)),
    [posts, since, net],
  );
  const dayRows = days.filter((d) => d.day >= since);
  const followers = dayRows.filter((d) => d.followers !== null).map((d) => ({ day: d.day, value: d.followers as number }));
  const reach = dayRows.filter((d) => d.reach !== null).map((d) => ({ day: d.day, value: d.reach as number }));
  const lastF = followers.at(-1)?.value ?? null;
  const firstF = followers[0]?.value ?? null;
  const fDelta = lastF !== null && firstF !== null && followers.length > 1 ? lastF - firstF : null;

  const totalInter = inPeriod.reduce((s, p) => s + interactionsOf(p.metrics), 0);
  const totalSeen = inPeriod.reduce((s, p) => s + seen(p.metrics), 0);
  const rates = inPeriod.map((p) => rate(p.metrics)).filter((r): r is number => r !== null);
  const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

  const chronological = [...inPeriod].sort((a, b) => (a.posted_at ?? '').localeCompare(b.posted_at ?? ''));
  const bars = chronological.slice(-24).map((p) => ({
    key: String(p.id),
    label: p.posted_at ? dShort(p.posted_at) : '',
    value: interactionsOf(p.metrics),
    network: p.network,
    detail: `${p.posted_at ? dShort(p.posted_at) : ''} · ${(p.caption || 'Post').slice(0, 48)}`,
  }));
  const table = [...inPeriod].sort((a, b) =>
    sort === 'interacoes' ? interactionsOf(b.metrics) - interactionsOf(a.metrics) : sort === 'alcance' ? (b.metrics.reach ?? seen(b.metrics)) - (a.metrics.reach ?? seen(a.metrics)) : (b.posted_at ?? '').localeCompare(a.posted_at ?? ''),
  );
  const showIgProfile = net !== 'linkedin';

  function refresh() {
    setMsg(null);
    start(async () => {
      const r = await refreshMetrics();
      setMsg({ ok: r.ok, text: r.message });
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {ig !== 'ok' && (
        <div className="perfNotice">
          <span>
            {ig === 'sem_conexao'
              ? 'Conecte o Instagram para os números chegarem sozinhos.'
              : 'Reconecte o Instagram uma vez para liberar os números dos posts e do perfil.'}
          </span>
          <Link className="btn3d btnSm" href="/app/redes">{ig === 'sem_conexao' ? 'Conectar' : 'Reconectar'}</Link>
        </div>
      )}

      <div className="perfFilters">
        <div className="segmented" role="radiogroup" aria-label="Período">
          {PERIODS.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}>{p} dias</button>
          ))}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Rede">
          {(['todas', 'instagram', 'linkedin'] as const).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={net === n} onClick={() => setNet(n)}>{n === 'todas' ? 'Todas' : NET_NAME[n]}</button>
          ))}
        </div>
        <span className="perfUpdated">
          {msg ? msg.text : updatedAt ? `Atualizado ${new Date(updatedAt).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}` : 'Ainda sem números'}
        </span>
        {ig === 'ok' && (
          <button type="button" className="btnGhost btnSm" onClick={refresh} disabled={pending}>{pending ? 'Atualizando…' : 'Atualizar'}</button>
        )}
      </div>

      <div className="statGrid">
        <Tile
          label="Seguidores no Instagram"
          value={lastF !== null ? fmtFull(lastF) : '—'}
          delta={fDelta !== null ? `${fDelta >= 0 ? '+' : ''}${fmtFull(fDelta)} em ${period} dias` : null}
          hint="Conta a partir da conexão"
        />
        <Tile label="Visualizações dos posts" value={inPeriod.length ? fmt(totalSeen) : '—'} hint={`${inPeriod.length} ${inPeriod.length === 1 ? 'post' : 'posts'} no período`} />
        <Tile label="Interações" value={inPeriod.length ? fmt(totalInter) : '—'} hint="Curtidas, comentários e mais" />
        <Tile label="Engajamento médio" value={pct(avgRate)} hint="Interações ÷ alcance, por post" />
      </div>

      {showIgProfile && (
        <div className="grid2">
          <section className="card perfCard" aria-labelledby="h-seg">
            <div className="perfCardHead">
              <h2 id="h-seg">Seguidores</h2>
              <span className="muted">Instagram</span>
            </div>
            {followers.length > 1 ? (
              <LineChart points={followers} label="Seguidores" color="var(--c-ig)" />
            ) : (
              <p className="perfEmpty">A curva aparece a partir do segundo dia de coleta.</p>
            )}
          </section>
          <section className="card perfCard" aria-labelledby="h-alc">
            <div className="perfCardHead">
              <h2 id="h-alc">Alcance por dia</h2>
              <span className="muted">Contas diferentes que viram o perfil</span>
            </div>
            {reach.length > 1 ? <LineChart points={reach} label="Alcance" color="var(--c-ig)" /> : <p className="perfEmpty">Sem números de alcance no período.</p>}
          </section>
        </div>
      )}

      <section className="card perfCard" aria-labelledby="h-int">
        <div className="perfCardHead">
          <h2 id="h-int">Interações por post</h2>
          <span className="muted">Últimos {bars.length} posts do período</span>
        </div>
        {bars.length ? <ColumnChart bars={bars} label="Interações" /> : <p className="perfEmpty">Nenhum post com números neste período.</p>}
      </section>

      <section className="card perfCard" aria-labelledby="h-posts">
        <div className="perfCardHead">
          <h2 id="h-posts">Posts</h2>
          <label className="perfSort">
            <span className="muted">Ordenar</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="recentes">Mais recentes</option>
              <option value="interacoes">Mais interações</option>
              <option value="alcance">Mais alcance</option>
            </select>
          </label>
        </div>
        {table.length ? (
          <div className="perfTableWrap">
            <table className="perfTable">
              <thead>
                <tr>
                  <th scope="col">Post</th>
                  <th scope="col">Visualizações</th>
                  <th scope="col">Alcance</th>
                  <th scope="col">Curtidas</th>
                  <th scope="col">Coment.</th>
                  <th scope="col">Salvos</th>
                  <th scope="col">Envios</th>
                  <th scope="col">Engaj.</th>
                </tr>
              </thead>
              <tbody>
                {table.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">
                      <span className="perfPost">
                        <span className="chartSwatch" style={{ background: NET_COLOR[p.network] ?? 'var(--muted)' }} aria-hidden="true" />
                        <span className="perfPostText">
                          <span className="perfPostTitle">{(p.caption || 'Post sem legenda').split('\n')[0]}</span>
                          <span className="muted">
                            {p.posted_at ? dShort(p.posted_at) : ''} · {NET_NAME[p.network] ?? p.network}
                            {p.media_type && TYPE[p.media_type] ? ` · ${TYPE[p.media_type]}` : ''}
                            {p.source === 'manual' ? ' · anotado' : ''}
                          </span>
                        </span>
                        <span className="perfLinks">
                          {p.post_id && <Link href={`/app/conteudos/${p.post_id}`}>Abrir</Link>}
                          {p.permalink && <a href={p.permalink} target="_blank" rel="noopener noreferrer">Ver</a>}
                        </span>
                      </span>
                    </th>
                    <td>{num(p.metrics.views ?? p.metrics.impressions)}</td>
                    <td>{num(p.metrics.reach)}</td>
                    <td>{num(p.metrics.likes)}</td>
                    <td>{num(p.metrics.comments)}</td>
                    <td>{num(p.metrics.saved)}</td>
                    <td>{num(p.metrics.shares)}</td>
                    <td>{pct(rate(p.metrics))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="perfEmpty">
            Ainda não há posts com números neste período. No Instagram eles chegam sozinhos; no LinkedIn, anote os números na página do post publicado.
          </p>
        )}
      </section>
    </div>
  );
}
