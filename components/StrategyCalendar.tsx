'use client';

import { useMemo, useState, useTransition } from 'react';
import { movePost } from '@/app/app/estrategia/actions';
import { NetworkIcon } from '@/components/NetworkIcon';
import { networkByName } from '@/lib/networks';
import { addDays, formatLong, formatShort, fromISO, specialDatesByDay, toISO, type SpecialDate } from '@/lib/dates';
import type { CalendarItem } from '@/lib/strategy';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

type Pillar = { nome: string; color: string };
type Props = {
  strategyId: number;
  items: CalendarItem[];
  pillars: Pillar[];
  /** Primeiro dia do plano (AAAA-MM-DD). */
  start: string;
  /** Hoje, no horário de Brasília (AAAA-MM-DD). */
  today: string;
};

type Placed = CalendarItem & { index: number; date: string };

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function StrategyCalendar({ strategyId, items, pillars, start, today }: Props) {
  const [overrides, setOverrides] = useState<Record<number, string | undefined>>(() =>
    Object.fromEntries(items.map((it, i) => [i, it.data])),
  );
  const planEnd = addDays(start, 29);
  const suggested = (it: CalendarItem) => addDays(start, it.dia - 1);
  const placed: Placed[] = items.map((it, index) => ({ ...it, index, date: overrides[index] ?? suggested(it) }));

  const initial = today >= start && today <= planEnd ? today : start;
  const [cursor, setCursor] = useState(() => ({ y: fromISO(initial).getFullYear(), m: fromISO(initial).getMonth() }));
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const special = useMemo(() => specialDatesByDay([cursor.y - 1, cursor.y, cursor.y + 1]), [cursor.y]);

  // Semanas do mês, começando na segunda.
  const weeks = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const total = Math.ceil((lead + days) / 7) * 7;
    const out: string[][] = [];
    for (let i = 0; i < total; i++) {
      if (i % 7 === 0) out.push([]);
      out[out.length - 1].push(toISO(new Date(cursor.y, cursor.m, 1 - lead + i)));
    }
    return out;
  }, [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, Placed[]>();
    for (const p of placed) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return map;
  }, [placed]);

  const monthSpecial = useMemo(() => {
    const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`;
    return Array.from(special.entries())
      .filter(([iso]) => iso.startsWith(prefix))
      .flatMap(([, list]) => list);
  }, [special, cursor]);

  const monthPosts = placed.filter((p) => fromISO(p.date).getFullYear() === cursor.y && fromISO(p.date).getMonth() === cursor.m).length;

  function go(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }
  function goTo(iso: string) {
    const d = fromISO(iso);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  }

  function move(index: number, date: string | null) {
    const before = overrides[index];
    const it = items[index];
    const target = date && date === suggested(it) ? null : date;
    setOverrides((o) => ({ ...o, [index]: target ?? undefined }));
    setError('');
    startTransition(async () => {
      const res = await movePost(strategyId, index, target);
      if (!res.ok) {
        setOverrides((o) => ({ ...o, [index]: before }));
        setError(res.error);
      }
    });
  }

  const sel = selected !== null ? placed[selected] : null;
  const pillarOf = (i: number) => pillars[i] ?? pillars[0];

  return (
    <section className="panel calPanel" aria-labelledby="h-cal">
      <div className="calTop">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <h2 id="h-cal" style={{ fontSize: 16 }}>Calendário</h2>
          <span className="muted" style={{ fontSize: 12 }}>
            Plano de {formatShort(start)} a {formatShort(planEnd)} · {monthPosts} {monthPosts === 1 ? 'post' : 'posts'} neste mês
          </span>
        </div>
        <div className="calNav">
          <button type="button" className="calIconBtn" onClick={() => go(-1)} aria-label="Mês anterior">‹</button>
          <span className="calMonth" aria-live="polite">{MONTHS[cursor.m]} {cursor.y}</span>
          <button type="button" className="calIconBtn" onClick={() => go(1)} aria-label="Próximo mês">›</button>
          <button type="button" className="calTodayBtn" onClick={() => goTo(today)}>Hoje</button>
          <button type="button" className="calTodayBtn" onClick={() => goTo(start)}>Início do plano</button>
        </div>
      </div>

      <div className="calGrid" role="grid" aria-label={`${MONTHS[cursor.m]} de ${cursor.y}`}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="calWd" role="columnheader">{w}</div>
        ))}
        {weeks.flat().map((iso) => {
          const d = fromISO(iso);
          const out = d.getMonth() !== cursor.m;
          const inPlan = iso >= start && iso <= planEnd;
          const posts = byDate.get(iso) ?? [];
          const sp: SpecialDate[] = special.get(iso) ?? [];
          const holiday = sp.find((s) => s.tipo === 'feriado');
          const cls = ['calDay', out && 'out', inPlan && 'inPlan', iso === today && 'today', holiday && 'holiday', sp.length > 0 && !holiday && 'special', overDay === iso && 'drop']
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={iso}
              role="gridcell"
              className={cls}
              title={sp.map((s) => `${s.nome}${s.tipo === 'feriado' ? ' (feriado)' : ''}`).join(' · ') || undefined}
              onDragOver={(e) => {
                if (dragging === null) return;
                e.preventDefault();
                if (overDay !== iso) setOverDay(iso);
              }}
              onDragLeave={() => setOverDay((o) => (o === iso ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging !== null) move(dragging, iso);
                setDragging(null);
                setOverDay(null);
              }}
            >
              <div className="calNum">
                <span>{d.getDate()}</span>
                {sp.length > 0 && <span className="calTag">{sp[0].nome}</span>}
                {sp.length > 0 && <span className="calDot" aria-hidden="true" />}
              </div>
              {posts.map((p) => {
                const pil = pillarOf(p.pilar);
                const net = networkByName(p.rede);
                return (
                  <button
                    key={p.index}
                    type="button"
                    className={selected === p.index ? 'calPost on' : 'calPost'}
                    style={{ '--c': pil.color } as React.CSSProperties}
                    draggable
                    onDragStart={(e) => {
                      setDragging(p.index);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(p.index));
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOverDay(null);
                    }}
                    onClick={() => setSelected((s) => (s === p.index ? null : p.index))}
                    aria-label={`${formatLong(p.date)}: ${p.formato} no ${p.rede} — ${p.tema}`}
                    aria-pressed={selected === p.index}
                  >
                    <span className="calPostTxt">{p.formato}</span>
                    {net && <span className="calPostNet">{net.short}</span>}
                    {p.comRosto && <span className="calPostF" aria-hidden="true">F</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {error && <div role="alert" className="formError">{error}</div>}

      {sel && (
        <div className="calDetail" aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
              {networkByName(sel.rede) && <NetworkIcon id={networkByName(sel.rede)!.id} size={36} />}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{cap(formatLong(sel.date))}</span>
                <b style={{ fontSize: 16, lineHeight: 1.35 }}>{sel.tema}</b>
              </div>
            </div>
            <button type="button" className="calIconBtn" onClick={() => setSelected(null)} aria-label="Fechar detalhes">×</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill"><span className="dot" style={{ background: pillarOf(sel.pilar).color }} />{pillarOf(sel.pilar).nome}</span>
            <span className="pill">{sel.formato}</span>
            <span className="pill">{sel.rede}</span>
            <span className="pill">{sel.comRosto ? 'Com rosto' : 'Sem rosto'}</span>
            <span className="pill">Objetivo: {sel.objetivo}</span>
          </div>
          <div className="calMove">
            <span className="muted" style={{ fontSize: 13, fontWeight: 700 }}>Mudar o dia</span>
            <div className="calMoveRow">
              <button type="button" className="calTodayBtn" disabled={pending} onClick={() => move(sel.index, addDays(sel.date, -1))} aria-label="Um dia antes">‹ 1 dia</button>
              <input
                type="date"
                className="calDateInput"
                value={sel.date}
                onChange={(e) => {
                  if (e.target.value) {
                    move(sel.index, e.target.value);
                    goTo(e.target.value);
                  }
                }}
                aria-label="Nova data do post"
              />
              <button type="button" className="calTodayBtn" disabled={pending} onClick={() => move(sel.index, addDays(sel.date, 1))} aria-label="Um dia depois">1 dia ›</button>
            </div>
            {sel.date !== suggested(sel) && (
              <button type="button" className="linkBtn" style={{ fontSize: 13, alignSelf: 'flex-start', minHeight: 32 }} disabled={pending} onClick={() => { move(sel.index, null); goTo(suggested(sel)); }}>
                Voltar para o dia sugerido ({formatShort(suggested(sel))})
              </button>
            )}
            <span className="muted" style={{ fontSize: 12 }}>{pending ? 'Salvando…' : 'No computador, você também pode arrastar o post para outro dia.'}</span>
          </div>
        </div>
      )}

      <div className="calLegend">
        {pillars.map((p) => (
          <span key={p.nome} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="dot" style={{ background: p.color }} />{p.nome}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="legendDot holiday" />feriado</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="legendDot special" />data especial</span>
        <span>F = com rosto</span>
      </div>

      {monthSpecial.length > 0 && (
        <div className="calSpecials">
          {monthSpecial.map((s) => (
            <span key={s.iso + s.nome} className={s.tipo === 'feriado' ? 'calSpecial holiday' : 'calSpecial'}>
              <b>{formatShort(s.iso)}</b> {s.nome}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
