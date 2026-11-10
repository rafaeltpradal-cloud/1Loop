// Desenha os "formatos reais" (lib/arte.ts) como cenas editáveis (lib/scene): print de post, conversa,
// checklist, comparativo, gráfico, anotação em post-it e carrossel em páginas de caderno.
// A cor de destaque vem da identidade da pessoa, mas o resto segue o "objeto real" (papel, app, post-it),
// para não ter cara de template. Só roda no navegador.
import type { PostContent } from '@/lib/contentTypes';
import type { Arte } from '@/lib/arte';
import { fitSize, layoutText, newId, type Layer, type LayerFont, type Scene, type TextLayer } from '@/lib/scene';
import { contrast, mix } from '@/lib/visual';
import type { Brand, ImageSpec, PostMeta } from '@/lib/postImage';

const W = 1080;
const H = 1350;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function t(p: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'text'>): TextLayer {
  return { id: newId(), type: 'text', size: 40, weight: 600, color: '#111111', align: 'left', lh: 1.25, ...p };
}
const rect = (x: number, y: number, w: number, h: number, fill: string, extra: { radius?: number; stroke?: string; strokeW?: number } = {}): Layer => ({ id: newId(), type: 'rect', x, y, w, h, fill, ...extra });

/** Destaque legível sobre branco, a partir da cor da pessoa. */
function accentOf(c: PostContent) {
  const a = c.visual?.cores.acento ?? '#2563EB';
  if (contrast(a, '#FFFFFF') >= 3) return a;
  return mix(a, '#000000', 0.35);
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '•';

const handleOf = (b: Brand) => b.handle || `@${b.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '').slice(0, 18) || 'perfil'}`;

/** Ajusta o texto à altura disponível e devolve a camada já com o tamanho. */
function fit(ctx: CanvasRenderingContext2D, font: string, base: Omit<TextLayer, 'size' | 'id' | 'type'>, maxH: number, max: number, min: number) {
  const partial = { id: newId(), type: 'text' as const, ...base };
  const size = fitSize(ctx, partial, font, maxH, max, min);
  const layer: TextLayer = { ...partial, size };
  return { layer, h: layoutText(ctx, layer, font).h };
}

function signature(brand: Brand, color: string, y = H - 92): Layer[] {
  return [t({ x: 80, y, w: W - 160, text: `${brand.name}  ·  ${handleOf(brand)}`, size: 26, weight: 600, color, align: 'right', lh: 1.1 })];
}

// ---------------------------------------------------------------------------
// Imagem única
// ---------------------------------------------------------------------------

function postShot(a: Arte, c: PostContent, brand: Brand, meta: PostMeta, ctx: CanvasRenderingContext2D, font: string): Scene {
  const acc = accentOf(c);
  const bg = mix(acc, '#FFFFFF', 0.86);
  const cx = 70;
  const cw = W - 140;
  const inner = cw - 120;
  const { layer: body, h: bodyH } = fit(ctx, font, { x: cx + 60, y: 0, w: inner, text: a.texto!, weight: 500, color: '#0F1419', align: 'left', lh: 1.34 }, 720, 66, 40);
  const cardH = 196 + bodyH + 150;
  const cy = Math.round((H - cardH) / 2);
  body.y = cy + 196;
  const [y, m, d] = (meta.date ?? '').split('-').map(Number);
  const time = /^\d{2}:\d{2}$/.test(meta.time ?? '') ? meta.time! : '08:00';
  const when = y && m && d ? `${time} · ${d} de ${MESES[m - 1]} de ${y}` : time;
  const layers: Layer[] = [
    rect(cx + 6, cy + 10, cw, cardH, 'rgba(15,20,25,0.06)', { radius: 40 }),
    rect(cx, cy, cw, cardH, '#FFFFFF', { radius: 40, stroke: '#E4E7EB', strokeW: 2 }),
    rect(cx + 60, cy + 60, 104, 104, acc, { radius: 52 }),
    t({ x: cx + 60, y: cy + 60 + 30, w: 104, text: initials(brand.name), size: 40, weight: 800, color: '#FFFFFF', align: 'center', lh: 1.1 }),
    t({ x: cx + 188, y: cy + 68, w: inner - 140, text: brand.name, size: 38, weight: 800, color: '#0F1419', lh: 1.15 }),
    t({ x: cx + 188, y: cy + 116, w: inner - 140, text: handleOf(brand), size: 31, weight: 500, color: '#536471', lh: 1.15 }),
    t({ x: cx + cw - 120, y: cy + 62, w: 60, text: '···', size: 40, weight: 800, color: '#8B98A5', align: 'right', lh: 1 }),
    body,
    rect(cx + 60, body.y + bodyH + 46, inner, 2, '#EFF3F4'),
    t({ x: cx + 60, y: body.y + bodyH + 74, w: inner, text: when, size: 29, weight: 500, color: '#536471', lh: 1.1 }),
  ];
  return { w: W, h: H, bg, layers };
}

function chat(a: Arte, ctx: CanvasRenderingContext2D, font: string): Scene {
  const acc = '#1F8A70';
  const top = 290;
  const bottom = H - 160;
  const P = 26;
  const maxBubble = 740;
  let msgs = a.mensagens ?? [];
  let size = 38;
  type Placed = { layers: Layer[]; h: number };
  const build = (sz: number, list: typeof msgs) => {
    const placed: Placed[] = [];
    list.forEach((m, i) => {
      const probe = t({ x: 0, y: 0, w: maxBubble, text: m.texto, size: sz, weight: 500, color: '#111B21', lh: 1.3, bg: '#000', bgMode: 'fit', pad: P });
      const box = layoutText(ctx, probe, font);
      const hh = String(9 + Math.floor(i / 2)).padStart(2, '0');
      const mm = String(12 + i * 3).padStart(2, '0');
      const time = `${hh}:${mm}`;
      const timeW = m.de === 'eu' ? 150 : 100;
      // Hora no canto de baixo: na mesma linha quando o texto é curto, numa linha própria quando não cabe.
      const oneLine = box.lines.length === 1 && box.boxW + timeW - P / 2 <= maxBubble;
      const bw = oneLine ? box.boxW + timeW - P / 2 : Math.max(box.boxW, timeW + P * 2);
      const bh = box.textH + P * 2 + (oneLine ? 0 : 28);
      const x = m.de === 'eu' ? W - 48 - bw : 48;
      const fill = m.de === 'eu' ? '#D9FDD3' : '#FFFFFF';
      placed.push({
        h: bh,
        layers: [
          rect(x, 0, bw, bh, fill, { radius: 24 }),
          t({ x: x + P, y: P, w: maxBubble - P * 2, text: m.texto, size: sz, weight: 500, color: '#111B21', lh: 1.3 }),
          t({ x: x + bw - P - timeW, y: bh - 40, w: timeW, text: m.de === 'eu' ? `${time} ✓✓` : time, size: 24, weight: 500, color: m.de === 'eu' ? '#53A2C7' : '#8696A0', align: 'right', lh: 1.1 }),
        ],
      });
    });
    const total = placed.reduce((s, p, i) => s + p.h + (i ? (list[i].de === list[i - 1].de ? 10 : 22) : 0), 0);
    return { placed, total };
  };
  let res = build(size, msgs);
  while (res.total > bottom - top && size > 30) res = build((size -= 2), msgs);
  while (res.total > bottom - top && msgs.length > 2) res = build(size, (msgs = msgs.slice(1)));

  const layers: Layer[] = [
    rect(0, 0, W, 180, '#F7F8FA'),
    rect(0, 179, W, 2, '#E2E5E9'),
    t({ x: 34, y: 58, w: 60, text: '‹', size: 76, weight: 500, color: acc, lh: 1 }),
    rect(100, 50, 96, 96, '#C9D1D9', { radius: 48 }),
    t({ x: 100, y: 78, w: 96, text: (a.contato ?? 'C')[0]!.toUpperCase(), size: 40, weight: 800, color: '#FFFFFF', align: 'center', lh: 1.1 }),
    t({ x: 222, y: 56, w: 640, text: a.contato ?? 'Cliente', size: 40, weight: 800, color: '#111B21', lh: 1.15 }),
    t({ x: 222, y: 106, w: 640, text: 'online', size: 28, weight: 500, color: '#667781', lh: 1.1 }),
    t({ x: 0, y: 214, w: W, text: 'Hoje', size: 26, weight: 600, color: '#54656F', align: 'center', bg: '#FFFFFF', bgMode: 'fit', pad: 14, radius: 14, lh: 1.1 }),
  ];
  let y = top;
  res.placed.forEach((p, i) => {
    if (i) y += msgs[i].de === msgs[i - 1].de ? 10 : 22;
    for (const l of p.layers) layers.push({ ...l, y: l.y + y } as Layer);
    y += p.h;
  });
  layers.push(
    rect(0, H - 130, W, 130, '#F0F2F5'),
    rect(30, H - 107, 860, 84, '#FFFFFF', { radius: 42 }),
    t({ x: 70, y: H - 85, w: 600, text: 'Mensagem', size: 32, weight: 500, color: '#8696A0', lh: 1.1 }),
    rect(918, H - 108, 86, 86, acc, { radius: 43 }),
    t({ x: 918, y: H - 88, w: 86, text: '➤', size: 38, weight: 700, color: '#FFFFFF', align: 'center', lh: 1.1 }),
  );
  return { w: W, h: H, bg: '#EFEAE2', pattern: { kind: 'pontos', color: 'rgba(0,0,0,0.035)', step: 28 }, layers };
}

function checklist(a: Arte, c: PostContent, brand: Brand, ctx: CanvasRenderingContext2D, font: string): Scene {
  const acc = accentOf(c);
  const ink = '#1D2433';
  const x0 = 170;
  const step = 96;
  const layers: Layer[] = [rect(128, 0, 3, H, '#F1B5B0')];
  const { layer: title, h: titleH } = fit(ctx, font, { x: x0, y: 96, w: W - x0 - 80, text: a.titulo || c.gancho, weight: 700, color: ink, align: 'left', lh: 1.05, font: 'hand' as LayerFont }, 260, 104, 66);
  layers.push(title);
  const start = Math.max(96 + titleH + 70, 330);
  // linhas do caderno
  for (let ly = start - 24; ly < H - 140; ly += step) layers.push(rect(0, ly + step + 6, W, 2, '#DCE3EE'));
  let y = start;
  for (const it of a.itens ?? []) {
    const box = 50;
    layers.push(rect(x0, y + 22, box, box, it.feito ? acc : '#FFFFFF', { radius: 10, stroke: it.feito ? acc : ink, strokeW: 4 }));
    if (it.feito) layers.push(t({ x: x0, y: y + 20, w: box, text: '✓', size: 42, weight: 800, color: '#FFFFFF', align: 'center', lh: 1.1 }));
    const item = t({ x: x0 + 82, y: y + 6, w: W - x0 - 82 - 70, text: it.texto, size: 62, weight: 500, color: ink, lh: step / 62, font: 'hand' });
    const lines = layoutText(ctx, item, font).lines.length;
    layers.push(item);
    y += step * Math.max(1, lines);
    if (y > H - 220) break;
  }
  layers.push(...signature(brand, '#8A93A3'));
  return { w: W, h: H, bg: '#FBF8F1', layers };
}

function versus(a: Arte, c: PostContent, brand: Brand, ctx: CanvasRenderingContext2D, font: string): Scene {
  const acc = accentOf(c);
  const pad = 80;
  const colW = (W - pad * 2 - 40) / 2;
  const xr = pad + colW + 40;
  const rows = a.linhas ?? [];
  const title = a.titulo ? fit(ctx, font, { x: pad, y: 0, w: W - pad * 2, text: a.titulo, weight: 800, color: '#111111', align: 'left', lh: 1.1 }, 260, 76, 48) : null;
  const head = (title ? title.h + 64 : 0) + 110;
  const room = H - 200 - 100 - head;
  let size = 48;
  const measure = (sz: number) =>
    rows.map(([a1, b1]) => {
      const h1 = layoutText(ctx, t({ x: 0, y: 0, w: colW - 20, text: a1, size: sz, weight: 500, lh: 1.28 }), font).h;
      const h2 = layoutText(ctx, t({ x: 0, y: 0, w: colW - 20, text: b1, size: sz, weight: 700, lh: 1.28 }), font).h;
      return Math.max(h1, h2) + 64;
    });
  let hs = measure(size);
  while (hs.reduce((s2, h) => s2 + h, 0) > room && size > 28) hs = measure((size -= 2));
  const total = head + hs.reduce((s2, h) => s2 + h, 0);
  // Bloco centralizado na altura (sem sobrar meia peça vazia embaixo).
  let y = Math.max(100, Math.round((H - 120 - total) / 2));
  const layers: Layer[] = [];
  if (title) {
    title.layer.y = y;
    layers.push(title.layer);
    y += title.h + 64;
  }
  const [l, r] = a.colunas ?? ['Antes', 'Depois'];
  layers.push(
    t({ x: pad, y, w: colW, text: `✕  ${l}`, size: 34, weight: 800, color: '#5F6368', bg: '#EFEFEF', bgMode: 'full', pad: 24, radius: 18, lh: 1.1 }),
    t({ x: xr, y, w: colW, text: `✓  ${r}`, size: 34, weight: 800, color: '#FFFFFF', bg: acc, bgMode: 'full', pad: 24, radius: 18, lh: 1.1 }),
  );
  y += 110;
  rows.forEach(([a1, b1], i) => {
    layers.push(
      t({ x: pad + 10, y: y + 32, w: colW - 20, text: a1, size, weight: 500, color: '#6B6F76', lh: 1.28 }),
      t({ x: xr + 10, y: y + 32, w: colW - 20, text: b1, size, weight: 700, color: '#111111', lh: 1.28 }),
    );
    y += hs[i]!;
    if (i < rows.length - 1) layers.push(rect(pad, y, W - pad * 2, 2, '#ECECEC'));
  });
  layers.push(...signature(brand, '#9AA0A6'));
  return { w: W, h: H, bg: '#FFFFFF', layers };
}

function chart(a: Arte, c: PostContent, brand: Brand, ctx: CanvasRenderingContext2D, font: string): Scene {
  const acc = accentOf(c);
  const pad = 90;
  const layers: Layer[] = [];
  const { layer: title, h: th } = fit(ctx, font, { x: pad, y: 100, w: W - pad * 2, text: a.titulo!, weight: 800, color: '#111111', align: 'left', lh: 1.1 }, 230, 64, 44);
  layers.push(title);
  const bars = a.barras ?? [];
  const max = Math.max(...bars.map((b) => b.valor), 1);
  const top = Math.max(100 + th + 120, 420);
  const base = H - 300;
  const chartH = base - top;
  const gap = bars.length > 5 ? 26 : 40;
  const bw = (W - pad * 2 - gap * (bars.length - 1)) / bars.length;
  for (let k = 1; k <= 4; k++) layers.push(rect(pad, base - (chartH * k) / 4, W - pad * 2, 2, '#F0F1F3'));
  const best = bars.reduce((bi, b, i) => (b.valor >= bars[bi]!.valor ? i : bi), 0);
  bars.forEach((b, i) => {
    const h = Math.max(8, (b.valor / max) * chartH);
    const x = pad + i * (bw + gap);
    layers.push(rect(x, base - h, bw, h, i === best ? acc : '#D6DAE1', { radius: Math.min(14, bw / 4) }));
    if (a.valores) layers.push(t({ x: x - gap / 2, y: base - h - 58, w: bw + gap, text: `${b.valor.toLocaleString('pt-BR')}${a.unidade ?? ''}`, size: bars.length > 5 ? 30 : 36, weight: 800, color: i === best ? acc : '#5F6368', align: 'center', lh: 1.1 }));
    layers.push(t({ x: x - gap / 2, y: base + 24, w: bw + gap, text: b.rotulo, size: bars.length > 5 ? 26 : 30, weight: 600, color: '#5F6368', align: 'center', lh: 1.15 }));
  });
  layers.push(rect(pad, base, W - pad * 2, 3, '#202124'));
  if (a.nota) layers.push(t({ x: pad, y: H - 170, w: W - pad * 2, text: a.nota, size: 28, weight: 500, color: '#80868B', lh: 1.3 }));
  layers.push(...signature(brand, '#9AA0A6'));
  return { w: W, h: H, bg: '#FFFFFF', layers };
}

function sticky(a: Arte, c: PostContent, brand: Brand, ctx: CanvasRenderingContext2D, font: string): Scene {
  const acc = c.visual?.cores.acento && contrast(c.visual.cores.acento, '#FFE873') >= 2.2 ? c.visual.cores.acento : '#D93F3F';
  const nx = 120;
  const ny = 230;
  const nw = W - 240;
  const nh = 860;
  const { layer, h } = fit(ctx, font, { x: nx + 80, y: 0, w: nw - 160, text: a.texto!, weight: 700, color: '#1F2328', align: 'left', lh: 1.18, font: 'hand' as LayerFont, hi: a.destaque, hiStyle: 'underline', hiColor: acc }, nh - 200, 120, 64);
  layer.y = ny + (nh - h) / 2 - 10;
  return {
    w: W,
    h: H,
    bg: '#E9E4DA',
    pattern: { kind: 'pontos', color: 'rgba(0,0,0,0.04)', step: 22 },
    layers: [
      rect(nx + 16, ny + 22, nw, nh, 'rgba(60,45,10,0.16)', { radius: 8 }),
      rect(nx, ny, nw, nh, '#FFE873', { radius: 6 }),
      rect(nx, ny + nh - 120, nw, 120, 'rgba(0,0,0,0.035)', { radius: 6 }),
      rect(W / 2 - 120, ny - 30, 240, 64, 'rgba(255,255,255,0.62)', { radius: 4 }),
      layer,
      t({ x: nx + 80, y: ny + nh - 96, w: nw - 160, text: `— ${brand.name.split(/\s+/)[0]}`, size: 54, weight: 500, color: '#5A5236', align: 'right', lh: 1.1, font: 'hand' }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Carrossel em páginas de caderno
// ---------------------------------------------------------------------------

function notebookSlides(c: PostContent, brand: Brand): ImageSpec[] {
  const slides = c.slides ?? [];
  const n = slides.length;
  return slides.map((s, i) => ({
    key: `slide-${i + 1}`,
    label: `Slide ${i + 1}`,
    w: W,
    h: H,
    build: (ctx, font) => {
      const acc = accentOf(c);
      const pad = 96;
      const first = i === 0;
      const last = i === n - 1 && n > 1;
      const layers: Layer[] = [
        t({ x: pad, y: 78, w: 600, text: brand.serie.toUpperCase(), size: 24, weight: 800, color: '#9A9488', ls: 2, lh: 1.1 }),
        t({ x: W - pad - 200, y: 74, w: 200, text: `${String(i + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`, size: 28, weight: 700, color: '#9A9488', align: 'right', lh: 1.1, font: 'mono' }),
      ];
      if (first) {
        const words = s.titulo.split(/\s+/);
        const hi = words.slice(-Math.min(3, Math.max(1, Math.floor(words.length / 3)))).join(' ');
        const { layer, h } = fit(ctx, font, { x: pad, y: 0, w: W - pad * 2, text: s.titulo, weight: 800, color: '#1A1A1A', align: 'left', lh: 1.12, font: 'serif', hi, hiStyle: 'brush', hiColor: '#FFE58A', hiInk: '#1A1A1A' }, 600, 112, 60);
        layer.y = 330;
        layers.push(layer);
        if (s.texto) layers.push(t({ x: pad, y: 330 + h + 50, w: W - pad * 2 - 80, text: s.texto, size: 42, weight: 500, color: '#55524C', lh: 1.38 }));
        layers.push(t({ x: pad, y: H - 210, w: W - pad * 2, text: 'arrasta →', size: 64, weight: 700, color: acc, align: 'right', lh: 1.1, font: 'hand' }));
      } else {
        layers.push(t({ x: pad - 6, y: 190, w: 300, text: last ? '★' : `${i}.`, size: 120, weight: 700, color: acc, lh: 1, font: 'hand' }));
        const { layer, h } = fit(ctx, font, { x: pad, y: 350, w: W - pad * 2, text: s.titulo, weight: 800, color: '#1A1A1A', align: 'left', lh: 1.14, font: 'serif' }, 330, 80, 50);
        layers.push(layer);
        if (s.texto) {
          const { layer: body } = fit(ctx, font, { x: pad, y: 350 + h + 44, w: W - pad * 2, text: s.texto, weight: 500, color: '#3A3833', align: 'left', lh: 1.42 }, H - 260 - (350 + h + 44), 46, 32);
          layers.push(body);
        }
        if (last) layers.push(t({ x: pad, y: H - 210, w: W - pad * 2, text: 'salva pra consultar depois ✎', size: 56, weight: 700, color: acc, align: 'right', lh: 1.1, font: 'hand' }));
      }
      layers.push(t({ x: pad, y: H - 108, w: W - pad * 2, text: `${brand.name}  ·  ${handleOf(brand)}`, size: 26, weight: 600, color: '#9A9488', lh: 1.1 }));
      return { w: W, h: H, bg: '#FAF8F3', pattern: { kind: 'pontos', color: '#E2DCCF', step: 36 }, layers };
    },
  }));
}

/** Imagens do post no formato real escolhido, ou null para cair no visual normal. */
export function arteSpecs(kind: string, c: PostContent, brand: Brand, meta: PostMeta = {}): ImageSpec[] | null {
  const a = c.arte;
  if (!a || a.tipo === 'frase') return null;
  if (kind === 'carrossel') return a.tipo === 'documento' && c.slides?.length ? notebookSlides(c, brand) : null;
  if (kind !== 'imagem') return null;
  const one = (build: (ctx: CanvasRenderingContext2D, font: string) => Scene): ImageSpec[] => [{ key: 'imagem', label: 'Imagem', w: W, h: H, build }];
  switch (a.tipo) {
    case 'post':
      return a.texto ? one((ctx, font) => postShot(a, c, brand, meta, ctx, font)) : null;
    case 'conversa':
      return a.mensagens?.length ? one((ctx, font) => chat(a, ctx, font)) : null;
    case 'lista':
      return a.itens?.length ? one((ctx, font) => checklist(a, c, brand, ctx, font)) : null;
    case 'comparativo':
      return a.linhas?.length ? one((ctx, font) => versus(a, c, brand, ctx, font)) : null;
    case 'grafico':
      return a.barras?.length ? one((ctx, font) => chart(a, c, brand, ctx, font)) : null;
    case 'anotacao':
      return a.texto ? one((ctx, font) => sticky(a, c, brand, ctx, font)) : null;
    default:
      return null;
  }
}
