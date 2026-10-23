'use client';

// Gráficos do Desempenho, desenhados em SVG (sem biblioteca).
// Linhas de 2px, barras de no máximo 24px com ponta arredondada, grade discreta e dica ao passar o mouse.

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export const NET_COLOR: Record<string, string> = { instagram: 'var(--c-ig)', linkedin: 'var(--c-li)' };
export const NET_NAME: Record<string, string> = { instagram: 'Instagram', linkedin: 'LinkedIn' };

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi` : n >= 10_000 ? `${Math.round(n / 1000)} mil` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')} mil` : String(Math.round(n));
export const fmtFull = (n: number) => Math.round(n).toLocaleString('pt-BR');
const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${Number(d)}/${Number(m)}`;
};

function niceMax(v: number) {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * p;
}

type Tip = { x: number; y: number; title: string; rows: { label: string; value: string; color?: string }[] } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="chartTip" style={{ left: tip.x, top: tip.y }} role="status">
      <span className="chartTipTitle">{tip.title}</span>
      {tip.rows.map((r) => (
        <span key={r.label} className="chartTipRow">
          {r.color && <span className="chartTipKey" style={{ background: r.color }} aria-hidden="true" />}
          <b>{r.value}</b>
          <span>{r.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Largura real do quadro, para desenhar sem distorcer texto nem pontos. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(240, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(240, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const PAD = { l: 40, r: 16, t: 12, b: 26 };

/** Linha única ao longo dos dias (ex.: seguidores, alcance). */
export function LineChart({ points, label, color = 'var(--c-li)', height = 200 }: { points: { day: string; value: number }[]; label: string; color?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth();
  const gid = useId().replace(/:/g, '');
  const H = height;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  // Seguidores mudam pouco: a escala começa perto do menor valor; alcance começa do zero.
  const floor = min > 0 && (max - min) / max < 0.25 ? Math.floor((min * 0.98) / 10) * 10 : 0;
  const top = floor + niceMax(Math.max(1, max - floor));
  const x = (i: number) => PAD.l + (points.length <= 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
  const y = (v: number) => PAD.t + (1 - (v - floor) / (top - floor)) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((f) => floor + f * (top - floor));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${path} L${x(points.length - 1)},${y(floor)} L${x(0)},${y(floor)} Z` : '';
  const labelsEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(W / 90))));

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    setHover(best);
  }

  const tip: Tip =
    hover !== null
      ? {
          x: x(hover),
          y: y(points[hover].value),
          title: dayLabel(points[hover].day),
          rows: [{ label, value: fmtFull(points[hover].value), color }],
        }
      : null;

  return (
    <div className="chartBox" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label} por dia`} onPointerMove={move} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.12" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chartGrid" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="chartAxis">{fmt(t)}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelsEvery === 0 || i === points.length - 1 ? (
            <text key={p.day} x={x(i)} y={H - 6} textAnchor="middle" className="chartAxis">{dayLabel(p.day)}</text>
          ) : null,
        )}
        {area && <path d={area} fill={`url(#g${gid})`} />}
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} className="chartCross" />}
        {points.length > 0 && (
          <circle cx={x(hover ?? points.length - 1)} cy={y(points[hover ?? points.length - 1].value)} r="4.5" fill={color} stroke="var(--surface)" strokeWidth="2" />
        )}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
}

export type Bar = { key: string; label: string; value: number; network: string; detail?: string };

/** Uma coluna por post, na cor da rede. */
export function ColumnChart({ bars, label, height = 220 }: { bars: Bar[]; label: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, W] = useWidth();
  const H = height;
  const top = niceMax(Math.max(1, ...bars.map((b) => b.value)));
  const inner = W - PAD.l - PAD.r;
  const slot = inner / Math.max(1, bars.length);
  const bw = Math.min(24, Math.max(6, slot - 6));
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const ticks = [0, 0.5, 1].map((f) => f * top);
  const labelsEvery = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor(W / 70))));
  const nets = useMemo(() => Array.from(new Set(bars.map((b) => b.network))), [bars]);

  const tip: Tip =
    hover !== null
      ? {
          x: PAD.l + slot * hover + slot / 2,
          y: y(bars[hover].value),
          title: bars[hover].detail ?? bars[hover].label,
          rows: [{ label, value: fmtFull(bars[hover].value), color: NET_COLOR[bars[hover].network] }],
        }
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {nets.length > 1 && (
        <div className="chartLegend">
          {nets.map((n) => (
            <span key={n}>
              <span className="chartSwatch" style={{ background: NET_COLOR[n] }} aria-hidden="true" />
              {NET_NAME[n] ?? n}
            </span>
          ))}
        </div>
      )}
      <div className="chartBox" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="chartGrid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="chartAxis">{fmt(t)}</text>
            </g>
          ))}
          {bars.map((b, i) => {
            const cx = PAD.l + slot * i + slot / 2;
            const h = Math.max(b.value > 0 ? 2 : 0, y(0) - y(b.value));
            const r = Math.min(4, bw / 2, h);
            const x0 = cx - bw / 2;
            const yTop = y(0) - h;
            // ponta de cima arredondada, base reta
            const d = h > 0 ? `M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + bw - r} Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r} V${y(0)} Z` : '';
            return (
              <g key={b.key} onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${b.detail ?? b.label}: ${fmtFull(b.value)} ${label.toLowerCase()}`}>
                <rect x={PAD.l + slot * i} y={PAD.t} width={slot} height={H - PAD.t - PAD.b} fill="transparent" />
                {d && <path d={d} fill={NET_COLOR[b.network] ?? 'var(--c-li)'} opacity={hover === null || hover === i ? 1 : 0.45} />}
                {i % labelsEvery === 0 && (
                  <text x={cx} y={H - 6} textAnchor="middle" className="chartAxis">{b.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        <Tooltip tip={tip} />
      </div>
    </div>
  );
}

/** Curvinha pequena (histórico de um post). */
export function Sparkline({ values, color = 'var(--c-li)' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i * w) / (values.length - 1)},${h - 3 - ((v - min) / (max - min || 1)) * (h - 6)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
