import { PILLAR_COLORS, type Strategy } from '@/lib/strategy';
import { StrategyCalendar } from '@/components/StrategyCalendar';
import { addDays, formatShort } from '@/lib/dates';

const STAGE_COLORS = ['#3B6CF6', '#7C4DFF', '#C23B8A', '#B85F00'];

function color(i: number) {
  return PILLAR_COLORS[i % PILLAR_COLORS.length];
}

export function StrategyView({ s, strategyId, start, today }: { s: Strategy; strategyId: number; start: string; today: string }) {
  // Datas reais de cada post (o dia sugerido ou o dia que a pessoa escolheu no calendário).
  const dated = s.calendario
    .map((c) => ({ ...c, date: c.data ?? addDays(start, c.dia - 1) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = dated.filter((c) => c.date >= today);
  const upcoming = (next.length >= 3 ? next : dated).slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cabeçalho */}
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span className="pill">Objetivo: {s.objetivo}</span>
          <span className="pill">Série: {s.serie.nome}</span>
          <span className="pill" style={{ background: 'var(--grey)', color: '#fff', borderColor: 'var(--grey)' }}>{s.ritmo.frequencia} · {s.ritmo.horario}</span>
          {s.ritmo.redes.map((r) => <span key={r} className="pill">{r}</span>)}
        </div>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--ink-2)' }}>{s.resumo}</p>
        <div className="muted" style={{ fontSize: 14 }}><b style={{ color: 'var(--ink-2)' }}>Posicionamento:</b> {s.posicionamento}</div>
      </div>

      <div className="grid2">
        {/* Pilares */}
        <section className="panel" aria-labelledby="h-pilares" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 id="h-pilares" style={{ fontSize: 16 }}>Pilares de conteúdo</h2>
            <span className="muted" style={{ fontSize: 12 }}>mix do mês</span>
          </div>
          <div role="img" aria-label={s.pilares.map((p) => `${p.nome} ${p.percentual}%`).join(', ')} style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden' }}>
            {s.pilares.map((p, i) => <div key={p.nome} style={{ width: `${p.percentual}%`, background: color(i) }} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {s.pilares.map((p, i) => (
              <div key={p.nome} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: 12, height: 12, marginTop: 4, borderRadius: 4, background: color(i) }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <b style={{ fontSize: 14 }}>{p.nome} · {p.percentual}%</b>
                  <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>{p.descricao}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Funil */}
        <section className="panel" aria-labelledby="h-funil" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2 id="h-funil" style={{ fontSize: 16 }}>Jornada do seu público</h2>
            <span className="muted" style={{ fontSize: 12 }}>o papel de cada conteúdo</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            {s.funil.map((f, i) => (
              <div key={f.etapa} style={{ width: `${100 - i * 13}%`, minHeight: 48, borderRadius: 12, background: STAGE_COLORS[i], color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 16px', gap: 2 }}>
                <b style={{ fontSize: 13 }}>{f.etapa}</b>
                <span style={{ fontSize: 12, opacity: 0.92 }}>{f.papel}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Calendário (em cima) */}
      <StrategyCalendar
        strategyId={strategyId}
        items={s.calendario}
        pillars={s.pilares.map((p, i) => ({ nome: p.nome, color: color(i) }))}
        start={start}
        today={today}
      />

      {/* Plano de ação (embaixo) */}
      <section className="panelDark" aria-labelledby="h-acao" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2 id="h-acao" style={{ fontSize: 16 }}>Plano de ação</h2>
          <span style={{ fontSize: 12, color: '#9AA1AA' }}>4 semanas</span>
        </div>
        <div className="actionGrid">
          {s.planoAcao.map((w, i) => (
            <div key={w.semana} className="actionItem">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, background: STAGE_COLORS[i % STAGE_COLORS.length], color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{w.semana}</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9AA1AA' }}>Semana {w.semana}</span>
              </div>
              <b style={{ fontSize: 15, lineHeight: 1.35 }}>{w.foco}</b>
              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.45, color: '#B4BAC2' }}>
                {w.acoes.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Próximos conteúdos */}
      <section className="card" aria-labelledby="h-prox" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="h-prox" style={{ fontSize: 16 }}>Próximos conteúdos</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {upcoming.map((c) => (
            <div key={`${c.dia}-${c.date}`} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700 }}>
                  <span className="dot" style={{ background: color(c.pilar) }} />{formatShort(c.date)} · {c.rede}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--muted)' }}>{c.objetivo}</span>
              </div>
              <b style={{ fontSize: 14, lineHeight: 1.4 }}>{c.tema}</b>
              <span className="muted" style={{ fontSize: 12 }}>{c.formato}{c.comRosto ? ' · com rosto' : ' · sem rosto'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Indicadores */}
      <section aria-labelledby="h-ind" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 id="h-ind" style={{ fontSize: 16 }}>O que vamos acompanhar</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {s.indicadores.map((x, i) => (
            <div key={x.nome} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, boxShadow: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="dot" style={{ background: color(i) }} /><b style={{ fontSize: 14 }}>{x.nome}</b></div>
              <span className="muted" style={{ fontSize: 13, lineHeight: 1.45 }}>{x.porque}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
