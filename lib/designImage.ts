// Imagens dos posts no visual próprio de cada pessoa (lib/visual.ts): 8 layouts que usam as fontes,
// cores, fundo, forma e destaque da identidade, com variação de post para post.
// Gera cenas editáveis (lib/scene), as mesmas que o editor visual abre. Só roda no navegador.
import type { FormatKind, PostContent, Story } from '@/lib/contentTypes';
import { fitSize, layoutText, newId, type Layer, type Pattern, type Scene, type TextLayer } from '@/lib/scene';
import { mix, paletteOf, type Layout, type Visual } from '@/lib/visual';
import type { Brand, ImageSpec } from '@/lib/postImage';

type Pal = ReturnType<typeof paletteOf>;
type Ctx = { ctx: CanvasRenderingContext2D; font: string; W: number; H: number; pad: number; v: Visual; p: Pal };

const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

function t(p: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'text'>): TextLayer {
  return { id: newId(), type: 'text', size: 40, weight: 700, color: '#000000', align: 'left', lh: 1.2, ...p };
}

const rect = (x: number, y: number, w: number, h: number, fill: string, extra: { radius?: number; stroke?: string; strokeW?: number } = {}): Layer => ({ id: newId(), type: 'rect', x, y, w, h, fill, ...extra });

/** Destaque do trecho marcado, no jeito da identidade. */
function hiProps(c: Ctx): Partial<TextLayer> {
  const { v, p } = c;
  switch (v.destaque) {
    case 'gradiente':
      return { hiStyle: 'gradient', hiColor: p.accent, hiColor2: p.accent2 === p.accent ? mix(p.accent, p.ink, 0.4) : p.accent2 };
    case 'caixa':
      return { hiStyle: 'box', hiColor: p.accent, hiInk: p.onAccent };
    case 'pincel':
      return { hiStyle: 'brush', hiColor: p.accent, hiInk: p.onAccent };
    case 'sublinhado':
      return { hiStyle: 'underline', hiColor: p.accent };
    default:
      return { hiStyle: 'color', hiColor: p.accent };
  }
}

/** Fundo da cena: sólido, degradê, radial ou com textura. */
function background(c: Ctx): Pick<Scene, 'bg' | 'pattern' | 'glow' | 'glowColor'> {
  const { v, p } = c;
  const deg = 30 + (v.semente % 120);
  const tex = (kind: Pattern['kind'], step: number): Pattern => ({ kind, color: alpha(p.ink.length === 7 ? p.ink : '#000000', 0.07), step });
  switch (v.fundo) {
    case 'gradiente':
      return { bg: `g:${p.bg}:${p.bg2}:${deg}` };
    case 'radial':
      return { bg: `r:${p.bg2}:${p.bg}` };
    case 'grade':
      return { bg: p.bg, pattern: tex('grade', 54) };
    case 'pontos':
      return { bg: p.bg, pattern: tex('pontos', 36) };
    case 'listras':
      return { bg: p.bg, pattern: tex('listras', 44) };
    default:
      return { bg: p.bg };
  }
}

/** Forma decorativa da identidade (fica atrás do texto). */
function shape(c: Ctx, area: { x: number; y: number; w: number; h: number } = { x: 0, y: 0, w: c.W, h: c.H }): Layer[] {
  const { v, p, W, H } = c;
  const corner = v.semente % 2 === 0;
  switch (v.forma) {
    case 'circulo': {
      const d = W * 0.62;
      return [rect(corner ? W - d * 0.62 : -d * 0.38, corner ? -d * 0.34 : H - d * 0.62, d, d, mix(p.bg, p.accent, 0.22), { radius: d / 2 })];
    }
    case 'arco': {
      const d = W * 0.7;
      return [rect(corner ? W - d * 0.55 : -d * 0.45, corner ? -d * 0.45 : H - d * 0.55, d, d, 'rgba(0,0,0,0)', { radius: d / 2, stroke: p.accent, strokeW: 16 })];
    }
    case 'barra':
      return [rect(area.x, area.y, 16, area.h, p.accent)];
    case 'moldura':
      return [rect(36, 36, W - 72, H - 72, 'rgba(0,0,0,0)', { radius: Math.min(v.raio, 40), stroke: alpha(p.ink.length === 7 ? p.ink : '#000000', 0.35), strokeW: 3 })];
    default:
      return [];
  }
}

/** Título que encaixa na caixa (maior tamanho possível), com a fonte e o destaque da identidade. */
function title(c: Ctx, layers: Layer[], str: string, hi: string | undefined, box: { x: number; y: number; w: number; bottom: number }, o: { max: number; min: number; align?: TextLayer['align']; anchor?: 'top' | 'center' | 'bottom'; color?: string; font?: Visual['titulo']; lh?: number } ) {
  const { v, p } = c;
  const font = o.font ?? v.titulo;
  const partial = {
    id: newId(),
    type: 'text' as const,
    x: box.x,
    y: box.y,
    w: box.w,
    text: str,
    weight: v.peso,
    color: o.color ?? p.ink,
    align: o.align ?? v.alinhamento,
    lh: o.lh ?? (font === 'display' ? 1.02 : font === 'serif' ? 1.12 : 1.14),
    hi: hi || undefined,
    font,
    upper: font === 'display' || v.caixaAlta || undefined,
    ls: font === 'display' ? 1 : v.caixaAlta ? 1 : undefined,
    ...hiProps(c),
  };
  const size = fitSize(c.ctx, partial, c.font, box.bottom - box.y, o.max, o.min);
  const layer: TextLayer = { ...partial, size };
  const { h } = layoutText(c.ctx, layer, c.font);
  if (o.anchor === 'bottom') layer.y = box.bottom - h;
  if (o.anchor === 'center') layer.y = box.y + (box.bottom - box.y - h) / 2;
  layers.push(layer);
  return { y: layer.y, end: layer.y + h };
}

/** Texto de apoio (fonte de texto da identidade). */
function body(c: Ctx, layers: Layer[], str: string, box: { x: number; y: number; w: number; bottom: number }, o: { max: number; min: number; align?: TextLayer['align']; color?: string } ) {
  const partial = { id: newId(), type: 'text' as const, x: box.x, y: box.y, w: box.w, text: str, weight: 600, color: o.color ?? c.p.muted, align: o.align ?? c.v.alinhamento, lh: 1.4, font: c.v.texto };
  const size = fitSize(c.ctx, partial, c.font, box.bottom - box.y, o.max, o.min);
  const layer: TextLayer = { ...partial, size };
  layers.push(layer);
  return layer.y + layoutText(c.ctx, layer, c.font).h;
}

/** Etiqueta pequena em caixa alta, espaçada (série, número, categoria). */
function label(c: Ctx, str: string, x: number, y: number, w: number, o: { color?: string; align?: TextLayer['align']; bg?: string; ink?: string; size?: number } = {}): TextLayer {
  return t({ x, y, w, text: str, size: o.size ?? 24, weight: 800, color: o.ink ?? o.color ?? c.p.muted, align: o.align ?? 'left', lh: 1.15, upper: true, ls: 3, font: c.v.texto === 'serif' ? 'sans' : c.v.texto, ...(o.bg ? { bg: o.bg, bgMode: 'fit' as const, pad: 12, radius: Math.min(c.v.raio, 12) } : {}) });
}

/** Assinatura: nome e @ da pessoa. */
function signature(c: Ctx, layers: Layer[], brand: Brand, y: number, o: { align?: TextLayer['align']; color?: string; muted?: string; right?: string } = {}) {
  const align = o.align ?? 'left';
  const x = c.pad;
  const w = c.W - c.pad * 2;
  layers.push(t({ x, y, w: align === 'left' && o.right ? w * 0.62 : w, text: brand.name, size: 28, weight: 800, color: o.color ?? c.p.ink, align, lh: 1.1, font: c.v.texto === 'mono' ? 'mono' : 'sans' }));
  if (brand.handle) layers.push(t({ x, y: y + 36, w: align === 'left' && o.right ? w * 0.62 : w, text: brand.handle, size: 23, weight: 600, color: o.muted ?? c.p.muted, align, lh: 1.1 }));
  if (o.right) layers.push(t({ x: c.W * 0.5, y: y + 18, w: c.W * 0.5 - c.pad, text: o.right, size: 24, weight: 700, color: o.muted ?? c.p.muted, align: 'right', lh: 1.1 }));
}

const serieTag = (n?: number) => (n ? `#${String(n).padStart(3, '0')}` : '');

type Single = { frase: string; destaque?: string; tag: string; sub?: string; brand: Brand; foto?: number; prova?: boolean };

// ---------------------------------------------------------------------------
// Layouts de peça única (1080 × 1350)
// ---------------------------------------------------------------------------

function editorial(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const L: Layer[] = [...shape(c, { x: pad - 46, y: 300, w: 0, h: H - 600 })];
  L.push(label(c, [s.tag, s.brand.serie].filter(Boolean).join('  ·  '), pad, pad + 6, W - pad * 2, { color: p.accent }));
  L.push(rect(pad, pad + 62, W - pad * 2, 2, alpha(p.ink.length === 7 ? p.ink : '#000000', 0.25)));
  const r = title(c, L, s.frase, s.destaque, { x: pad, y: pad + 150, w: W - pad * 2, bottom: H - pad - 230 }, { max: 104, min: 48, anchor: 'center', align: 'left' });
  if (s.sub) body(c, L, s.sub, { x: pad, y: r.end + 36, w: W - pad * 2, bottom: H - pad - 160 }, { max: 38, min: 26, align: 'left' });
  L.push(rect(pad, H - pad - 110, W - pad * 2, 2, alpha(p.ink.length === 7 ? p.ink : '#000000', 0.25)));
  signature(c, L, s.brand, H - pad - 80);
  return L;
}

function poster(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const L: Layer[] = [...shape(c)];
  L.push(label(c, s.tag || s.brand.serie, pad, pad, W - pad * 2, { bg: p.accent, ink: p.onAccent }));
  title(c, L, s.frase, s.destaque, { x: pad - 6, y: pad + 90, w: W - pad * 2 + 12, bottom: H - pad - 120 }, { max: 190, min: 64, anchor: 'center', align: 'left', lh: c.v.titulo === 'display' ? 0.98 : 1.04 });
  signature(c, L, s.brand, H - pad - 70, { right: s.brand.serie && s.tag ? s.brand.serie : undefined });
  return L;
}

function cartao(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, v, p } = c;
  const L: Layer[] = [];
  const cardBg = p.bg === c.v.cores.fundo ? (isLight(p.bg) ? '#FFFFFF' : mix(p.bg, '#FFFFFF', 0.08)) : c.v.cores.fundo;
  const ink = readableOn(cardBg, c.v.cores.tinta);
  const cx = 70;
  const cy = 190;
  const cw = W - cx * 2;
  const ch = H - cy - 170;
  L.push(rect(cx + 14, cy + 18, cw, ch, alpha('#000000', 0.12), { radius: v.raio }));
  L.push(rect(cx, cy, cw, ch, cardBg, { radius: v.raio }));
  // cabeçalho do cartão: avatar com iniciais e nome
  const ini = s.brand.name.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  L.push(rect(cx + 56, cy + 56, 84, 84, p.accent, { radius: 42 }));
  L.push(t({ x: cx + 56, y: cy + 78, w: 84, text: ini, size: 34, weight: 800, color: p.onAccent, align: 'center', lh: 1.1 }));
  L.push(t({ x: cx + 160, y: cy + 62, w: cw - 220, text: s.brand.name, size: 30, weight: 800, color: ink, lh: 1.1 }));
  L.push(t({ x: cx + 160, y: cy + 102, w: cw - 220, text: s.brand.handle || s.brand.serie, size: 24, weight: 600, color: mix(ink, cardBg, 0.4), lh: 1.1 }));
  const inner = { ...c, p: { ...p, ink, muted: mix(ink, cardBg, 0.35) } };
  const r = title(inner, L, s.frase, s.destaque, { x: cx + 56, y: cy + 190, w: cw - 112, bottom: cy + ch - (s.sub ? 220 : 70) }, { max: 88, min: 40, anchor: 'center', align: 'left', color: ink });
  if (s.sub) body(inner, L, s.sub, { x: cx + 56, y: r.end + 30, w: cw - 112, bottom: cy + ch - 60 }, { max: 34, min: 24, align: 'left', color: mix(ink, cardBg, 0.35) });
  L.push(label(c, [s.tag, s.brand.serie].filter(Boolean).join('  ·  '), pad, 96, W - pad * 2, { color: p.ink, align: 'center' }));
  return L;
}

function split(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const L: Layer[] = [];
  const top = Math.round(H * 0.44);
  if (s.foto) L.push({ id: newId(), type: 'image', x: 0, y: 0, w: W, h: top, media: s.foto, fit: 'cover' });
  else {
    L.push(rect(0, 0, W, top, p.accent));
    L.push(t({ x: pad, y: top - 250, w: W - pad * 2, text: s.tag || '“', size: 220, weight: 800, color: p.onAccent, lh: 1, font: c.v.titulo, upper: true }));
  }
  L.push(label(c, s.brand.serie || s.brand.name, pad, pad, W - pad * 2, s.foto ? { bg: p.bg, ink: p.ink } : { color: p.onAccent }));
  const r = title(c, L, s.frase, s.destaque, { x: pad, y: top + 70, w: W - pad * 2, bottom: H - pad - 130 }, { max: 88, min: 40, anchor: 'top', align: 'left' });
  if (s.sub) body(c, L, s.sub, { x: pad, y: r.end + 30, w: W - pad * 2, bottom: H - pad - 130 }, { max: 36, min: 26, align: 'left' });
  signature(c, L, s.brand, H - pad - 70);
  return L;
}

function minimal(c: Ctx, s: Single): Layer[] {
  const { W, H, p } = c;
  const pad = 140;
  const L: Layer[] = [...(c.v.forma === 'moldura' ? shape(c) : [])];
  L.push(rect(W / 2 - 40, 250, 80, 8, p.accent, { radius: 4 }));
  title(c, L, s.frase, s.destaque, { x: pad, y: 330, w: W - pad * 2, bottom: H - 330 }, { max: 72, min: 38, anchor: 'center', align: 'center' });
  L.push(t({ x: 0, y: H - 230, w: W, text: s.brand.name, size: 28, weight: 800, color: p.ink, align: 'center', lh: 1.1 }));
  if (s.brand.handle) L.push(t({ x: 0, y: H - 190, w: W, text: s.brand.handle, size: 23, weight: 600, color: p.muted, align: 'center', lh: 1.1 }));
  if (s.tag) L.push(label(c, s.tag, 0, 150, W, { align: 'center', color: p.muted }));
  return L;
}

function manchete(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const L: Layer[] = [];
  const rule = alpha(p.ink.length === 7 ? p.ink : '#000000', 0.8);
  L.push(t({ x: pad, y: pad - 10, w: W - pad * 2, text: s.brand.serie || s.brand.name, size: 64, weight: 800, color: p.ink, align: 'center', lh: 1.05, font: 'serif' }));
  L.push(rect(pad, pad + 78, W - pad * 2, 4, rule));
  L.push(rect(pad, pad + 88, W - pad * 2, 1.5, rule));
  L.push(label(c, [s.brand.name, s.tag].filter(Boolean).join('   ·   '), pad, pad + 104, W - pad * 2, { align: 'center', color: p.muted, size: 21 }));
  L.push(rect(pad, pad + 146, W - pad * 2, 1.5, rule));
  const r = title(c, L, s.frase, s.destaque, { x: pad, y: pad + 200, w: W - pad * 2, bottom: H - pad - 180 }, { max: 104, min: 44, anchor: 'top', align: 'left', font: c.v.titulo === 'sans' ? 'serif' : c.v.titulo });
  if (s.sub) body(c, L, s.sub, { x: pad, y: r.end + 30, w: W - pad * 2, bottom: H - pad - 120 }, { max: 34, min: 24, align: 'left' });
  L.push(rect(pad, H - pad - 70, W - pad * 2, 1.5, rule));
  L.push(t({ x: pad, y: H - pad - 46, w: W - pad * 2, text: s.brand.handle || s.brand.name, size: 23, weight: 700, color: p.muted, align: 'center', lh: 1.1 }));
  return L;
}

function citacao(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const L: Layer[] = [...shape(c)];
  L.push(t({ x: pad - 10, y: pad + 20, w: 300, text: '“', size: 300, weight: 800, color: p.accent, lh: 1, font: c.v.titulo === 'display' ? 'serif' : c.v.titulo }));
  const r = title(c, L, s.frase, s.prova ? undefined : s.destaque, { x: pad, y: pad + 270, w: W - pad * 2, bottom: H - pad - 200 }, { max: 84, min: 40, anchor: 'top', align: 'left' });
  L.push(rect(pad, Math.min(r.end + 50, H - pad - 150), 90, 6, p.accent, { radius: 3 }));
  signature(c, L, s.brand, H - pad - 80, { right: s.tag || undefined });
  return L;
}

function revista(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const d = W * 0.78;
  const L: Layer[] = [rect(W - d * 0.7, -d * 0.3, d, d, p.accent, { radius: d / 2 })];
  L.push(t({ x: W - d * 0.62, y: 70, w: d * 0.5, text: s.tag || '•', size: 120, weight: 800, color: p.onAccent, align: 'center', lh: 1, font: c.v.titulo, upper: true }));
  L.push(label(c, s.brand.serie || s.brand.name, pad, pad, W * 0.45, { color: p.ink }));
  const r = title(c, L, s.frase, s.destaque, { x: pad, y: H * 0.42, w: W - pad * 2, bottom: H - pad - 150 }, { max: 100, min: 44, anchor: 'bottom', align: 'left' });
  void r;
  signature(c, L, s.brand, H - pad - 80);
  return L;
}

const LAYOUT_FN: Record<Layout, (c: Ctx, s: Single) => Layer[]> = { editorial, poster, cartao, split, minimal, manchete, citacao, revista };

/** Peça única com foto: a foto ocupa tudo e o texto vem embaixo, no visual da pessoa. */
function withPhoto(c: Ctx, s: Single): Layer[] {
  const { W, H, pad, p } = c;
  const L: Layer[] = [
    { id: newId(), type: 'image', x: 0, y: 0, w: W, h: H, media: s.foto!, fit: 'cover' },
    rect(0, H * 0.3, W, H * 0.7, 'shade'),
  ];
  const light = { ...c, p: { ...p, ink: '#FFFFFF', muted: 'rgba(255,255,255,0.85)' } };
  L.push(label(c, [s.tag, s.brand.serie].filter(Boolean).join('  ·  ') || s.brand.name, pad, pad, W - pad * 2, { bg: p.accent, ink: p.onAccent }));
  title(light, L, s.frase, s.destaque, { x: pad, y: H * 0.42, w: W - pad * 2, bottom: H - pad - 130 }, { max: 92, min: 40, anchor: 'bottom', align: 'left', color: '#FFFFFF' });
  signature(light, L, s.brand, H - pad - 70, { color: '#FFFFFF', muted: 'rgba(255,255,255,0.8)' });
  return L;
}

function single(c: Ctx, s: Single): Layer[] {
  if (s.foto && c.v.layout !== 'split') return withPhoto(c, s);
  return LAYOUT_FN[c.v.layout](c, s);
}

// ---------------------------------------------------------------------------
// Utilidades de cor locais
// ---------------------------------------------------------------------------

function isLight(h: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return true;
  const n = parseInt(h.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 150;
}
function readableOn(bg: string, prefer: string) {
  return isLight(bg) === isLight(prefer) ? (isLight(bg) ? '#151515' : '#FFFFFF') : prefer;
}

function ctxFor(ctx: CanvasRenderingContext2D, font: string, W: number, H: number, v: Visual, pad = 96): Ctx {
  return { ctx, font, W, H, pad, v, p: paletteOf(v) };
}

// ---------------------------------------------------------------------------
// Specs por formato
// ---------------------------------------------------------------------------

function singleSpec(c0: PostContent, v: Visual, brand: Brand, serieNumero: number | undefined, prova: boolean): ImageSpec {
  const W = 1080;
  const H = 1350;
  return {
    key: 'imagem',
    label: prova ? 'Imagem de prova social' : 'Imagem de série',
    w: W,
    h: H,
    build: (ctx, font) => {
      const vv = prova && v.layout !== 'cartao' ? { ...v, layout: 'citacao' as Layout } : v;
      const c = ctxFor(ctx, font, W, H, vv);
      const layers = single(c, { frase: c0.imagem?.frase || c0.gancho, destaque: prova ? undefined : c0.imagem?.destaque, tag: prova ? 'Cliente' : serieTag(serieNumero), brand, foto: c0.foto, prova });
      return { w: W, h: H, ...background(c), layers };
    },
  };
}

function carouselSpecs(c0: PostContent, v: Visual, brand: Brand): ImageSpec[] {
  const slides = c0.slides ?? [];
  const W = 1080;
  const H = 1350;
  return slides.map((s, i) => ({
    key: `slide-${i + 1}`,
    label: `Slide ${i + 1}`,
    w: W,
    h: H,
    build: (ctx, font) => {
      const first = i === 0;
      const last = i === slides.length - 1 && slides.length > 1;
      if (first) {
        const c = ctxFor(ctx, font, W, H, v);
        const words = s.titulo.split(/\s+/).filter(Boolean);
        const layers = single(c, { frase: s.titulo, destaque: words.slice(-2).join(' '), sub: s.texto || undefined, tag: '', brand, foto: c0.foto });
        layers.push(t({ x: c.pad, y: H - c.pad - 50, w: W - c.pad * 2, text: 'Arraste →', size: 26, weight: 800, color: c0.foto ? '#FFFFFF' : c.p.accent, align: 'right', lh: 1.1 }));
        return { w: W, h: H, ...background(c), layers };
      }
      // Miolo e fechamento: o fechamento usa a cor de destaque como fundo.
      const c = ctxFor(ctx, font, W, H, last ? { ...v, modo: v.modo === 'acento' ? 'base' : 'acento' } : v);
      const { pad, p } = c;
      const L: Layer[] = [];
      if (v.forma === 'barra') L.push(rect(pad - 46, pad + 220, 16, 420, p.accent));
      L.push(t({ x: pad, y: pad, w: 400, text: String(i + 1).padStart(2, '0'), size: 120, weight: 800, color: p.accent, lh: 1, font: v.titulo }));
      L.push(label(c, `${i + 1}/${slides.length}`, pad, pad + 40, W - pad * 2, { align: 'right', color: p.muted }));
      const start = L.length;
      const r = title(c, L, s.titulo, undefined, { x: pad, y: pad + 200, w: W - pad * 2, bottom: pad + 600 }, { max: 92, min: 44, anchor: 'top', align: 'left' });
      const end = s.texto ? body(c, L, s.texto, { x: pad, y: r.end + 44, w: W - pad * 2, bottom: H - pad - 150 }, { max: 52, min: 28, align: 'left', color: last ? p.ink : p.muted }) : r.end;
      // Centraliza o bloco (título + texto) no espaço livre, para não sobrar vazio embaixo.
      const free = H - pad - 150 - (pad + 200) - (end - (pad + 200));
      const shift = Math.max(0, free * 0.42);
      for (let k = start; k < L.length; k++) (L[k] as TextLayer).y += shift;
      signature(c, L, brand, H - pad - 80, { right: last ? 'Salve este post' : undefined });
      return { w: W, h: H, ...background(c), layers: L };
    },
  }));
}

function coverSpec(c0: PostContent, v: Visual, brand: Brand): ImageSpec {
  const W = 1080;
  const H = 1920;
  return {
    key: 'capa',
    label: 'Capa do vídeo',
    w: W,
    h: H,
    build: (ctx, font) => {
      const c = ctxFor(ctx, font, W, H, v, 110);
      const capa = c0.roteiro?.capa || c0.gancho;
      const words = capa.split(/\s+/).filter(Boolean);
      const L: Layer[] = [];
      if (c0.foto) {
        L.push({ id: newId(), type: 'image', x: 0, y: 0, w: W, h: H, media: c0.foto, fit: 'cover' }, rect(0, H * 0.35, W, H * 0.65, 'shade'));
        const light = { ...c, p: { ...c.p, ink: '#FFFFFF' } };
        title(light, L, capa, words.slice(-2).join(' '), { x: c.pad, y: H * 0.45, w: W - c.pad * 2, bottom: H - c.pad - 220 }, { max: 150, min: 64, anchor: 'bottom', align: 'center', color: '#FFFFFF' });
      } else {
        L.push(...shape(c));
        title(c, L, capa, words.slice(-2).join(' '), { x: c.pad, y: H * 0.25, w: W - c.pad * 2, bottom: H * 0.75 }, { max: 150, min: 64, anchor: 'center', align: 'center' });
      }
      L.push(label(c, brand.serie || brand.name, c.pad, c.pad + 140, W - c.pad * 2, { align: 'center', bg: c.p.accent, ink: c.p.onAccent }));
      signature(c0.foto ? { ...c, p: { ...c.p, ink: '#FFFFFF', muted: 'rgba(255,255,255,0.8)' } } : c, L, brand, H - c.pad - 90, { align: 'center' });
      return { w: W, h: H, ...(c0.foto ? { bg: '#000000' } : background(c)), layers: L };
    },
  };
}

function storySpecs(c0: PostContent, v: Visual, brand: Brand): ImageSpec[] {
  const stories = c0.stories ?? [];
  const W = 1080;
  const H = 1920;
  return stories.map((s: Story, i) => ({
    key: `story-${i + 1}`,
    label: `Story ${i + 1}`,
    w: W,
    h: H,
    build: (ctx, font) => {
      const c = ctxFor(ctx, font, W, H, i % 2 === 1 ? { ...v, modo: v.modo === 'acento' ? 'base' : 'acento' } : v, 110);
      const { p, pad } = c;
      const L: Layer[] = [];
      const photo = i === 0 ? c0.foto : undefined;
      if (photo) L.push({ id: newId(), type: 'image', x: 0, y: 0, w: W, h: H, media: photo, fit: 'cover' }, rect(0, H * 0.3, W, H * 0.7, 'shade'));
      const maxW = W - pad * 2;
      const bw = (maxW - (stories.length - 1) * 10) / stories.length;
      stories.forEach((_, k) => L.push(rect(pad + k * (bw + 10), 70, bw, 8, k <= i ? (photo ? '#FFFFFF' : p.ink) : alpha(photo ? '#FFFFFF' : p.ink.length === 7 ? p.ink : '#000000', 0.25), { radius: 4 })));
      const cc = photo ? { ...c, p: { ...p, ink: '#FFFFFF' } } : c;
      let y: number;
      if (s.tipo === 'texto') y = title(cc, L, s.texto, undefined, { x: pad, y: H * 0.22, w: maxW, bottom: H * 0.78 }, { max: 104, min: 48, anchor: photo ? 'bottom' : 'center', align: 'center', color: photo ? '#FFFFFF' : undefined }).end;
      else y = title(cc, L, s.texto, undefined, { x: pad, y: H * 0.24, w: maxW, bottom: H * 0.5 }, { max: 96, min: 48, anchor: 'bottom', align: 'center', color: photo ? '#FFFFFF' : undefined }).end;
      y += 70;
      const card = isLight(p.bg) ? '#FFFFFF' : 'rgba(255,255,255,0.12)';
      const ink = isLight(p.bg) ? '#151515' : '#FFFFFF';
      if (s.tipo === 'enquete') {
        (s.opcoes ?? ['Sim', 'Não']).forEach((o, k) => {
          L.push(rect(pad, y + k * 150, maxW, 120, card, { radius: 60, stroke: alpha('#000000', 0.08) }));
          L.push(t({ x: pad, y: y + k * 150 + 32, w: maxW, text: o, size: 46, weight: 800, color: ink, align: 'center', lh: 1.2 }));
        });
      } else if (s.tipo === 'caixinha') {
        L.push(rect(pad, y, maxW, 260, '#FFFFFF', { radius: 40 }), rect(pad, y, maxW, 90, p.accent, { radius: 40 }), rect(pad, y + 50, maxW, 40, p.accent));
        L.push(t({ x: pad, y: y + 24, w: maxW, text: 'Faça uma pergunta', size: 34, weight: 700, color: p.onAccent, align: 'center', lh: 1.2 }));
        L.push(t({ x: pad, y: y + 150, w: maxW, text: 'Escreva aqui…', size: 38, weight: 600, color: '#9AA1AA', align: 'center', lh: 1.2 }));
      } else if (s.tipo === 'link') {
        L.push(t({ x: pad, y, w: maxW, text: '🔗  Toque no link', size: 44, weight: 800, color: p.onAccent, align: 'center', bg: p.accent, bgMode: 'fit', pad: 32, radius: 56, lh: 1.2 }));
      }
      signature(photo ? { ...c, p: { ...p, ink: '#FFFFFF', muted: 'rgba(255,255,255,0.8)' } } : c, L, brand, H - pad - 90, { align: 'center' });
      return { w: W, h: H, ...(photo ? { bg: '#000000' } : background(c)), layers: L };
    },
  }));
}

/** Imagens de um post no visual próprio (null quando o formato não tem imagem desenhada). */
export function designSpecs(kind: FormatKind, c: PostContent, v: Visual, brand: Brand, serieNumero?: number): ImageSpec[] | null {
  if (kind === 'carrossel') return carouselSpecs(c, v, brand);
  if (kind === 'imagem') return [singleSpec(c, v, brand, serieNumero, false)];
  if (kind === 'prova') return [singleSpec(c, v, brand, serieNumero, true)];
  if (kind === 'video') return [coverSpec(c, v, brand)];
  if (kind === 'stories') return storySpecs(c, v, brand);
  return null;
}
