'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveManualMetrics } from '@/app/app/desempenho/actions';
import { Sparkline, fmtFull } from '@/components/perf/Charts';
import { interactionsOf, type Metrics } from '@/lib/metricsShared';

export type PostPerf = { network: string; metrics: Metrics; history: number[]; source: 'api' | 'manual'; updatedAt: string } | null;

const MANUAL: { key: keyof Metrics; label: string }[] = [
  { key: 'impressions', label: 'Impressões' },
  { key: 'likes', label: 'Reações' },
  { key: 'comments', label: 'Comentários' },
  { key: 'shares', label: 'Compartilhamentos' },
  { key: 'saved', label: 'Salvamentos' },
];

/** Números de um post publicado: do Instagram chegam sozinhos; nas outras redes, a pessoa anota. */
export function PostPerformance({ postId, rede, perf }: { postId: number; rede: string; perf: PostPerf }) {
  const router = useRouter();
  const auto = rede === 'Instagram';
  const m = perf?.metrics ?? {};
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries(MANUAL.map((f) => [f.key, m[f.key] !== undefined ? String(m[f.key]) : ''])));
  const [editing, setEditing] = useState(!auto && !perf);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const base = m.reach ?? m.impressions ?? 0;
  const engagement = base > 0 ? `${((interactionsOf(m) / base) * 100).toFixed(1).replace('.', ',')}%` : '—';
  const tiles = auto
    ? [
        ['Visualizações', m.views],
        ['Alcance', m.reach],
        ['Curtidas', m.likes],
        ['Comentários', m.comments],
        ['Salvamentos', m.saved],
        ['Envios', m.shares],
      ]
    : MANUAL.map((f) => [f.label, m[f.key]]);

  function save() {
    setMsg(null);
    start(async () => {
      const r = await saveManualMetrics(postId, Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== '').map(([k, v]) => [k, Number(v.replace(/\D/g, ''))])));
      if (!r.ok) return setMsg({ ok: false, text: r.error ?? 'Não deu para salvar.' });
      setEditing(false);
      setMsg({ ok: true, text: 'Números salvos.' });
      router.refresh();
    });
  }

  return (
    <section className="card perfCard" aria-labelledby="h-perf">
      <div className="perfCardHead">
        <h2 id="h-perf">Desempenho</h2>
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {perf && <span className="muted">{auto ? 'Atualizado' : 'Anotado'} em {new Date(perf.updatedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>}
          <Link className="perfLink" href="/app/desempenho">Ver tudo</Link>
        </span>
      </div>

      {perf && !editing && (
        <div className="perfPostGrid">
          {tiles.map(([label, v]) => (
            <div key={label as string} className="perfMini">
              <span className="statLabel">{label}</span>
              <b>{typeof v === 'number' ? fmtFull(v) : '—'}</b>
            </div>
          ))}
          <div className="perfMini">
            <span className="statLabel">Engajamento</span>
            <b>{engagement}</b>
            {perf.history.length > 1 && <Sparkline values={perf.history} color={auto ? 'var(--c-ig)' : 'var(--c-li)'} />}
          </div>
        </div>
      )}

      {auto && !perf && <p className="perfEmpty">Os números do Instagram aparecem aqui até 48 horas depois da publicação.</p>}

      {!auto && editing && (
        <form
          className="perfManual"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <p className="muted" style={{ fontSize: 13 }}>Copie os números da análise do post no {rede}. Dá para atualizar quando quiser.</p>
          <div className="perfManualGrid">
            {MANUAL.map((f) => (
              <label key={f.key} className="field">
                <span className="statLabel">{f.label}</span>
                <input inputMode="numeric" value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value.replace(/[^\d.]/g, '') }))} placeholder="0" />
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn3d btnSm" type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar números'}</button>
            {perf && <button className="linkBtn" type="button" onClick={() => setEditing(false)}>Cancelar</button>}
          </div>
        </form>
      )}
      {!auto && !editing && (
        <div>
          <button type="button" className="btnGhost btnSm" onClick={() => setEditing(true)}>Atualizar números</button>
        </div>
      )}
      {msg && <div role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'formOk' : 'formError'}>{msg.text}</div>}
    </section>
  );
}
