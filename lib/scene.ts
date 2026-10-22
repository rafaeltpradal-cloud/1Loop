// Cena editável das imagens dos posts: camadas de texto, retângulo e foto.
// O mesmo desenho serve para a prévia, o download e o editor visual. Só roda no navegador.

/** Cor CSS, ou "brand" (degradê da marca) ou "shade" (sombra escura de baixo para cima). */
export type Fill = string;

export type TextLayer = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  w: number;
  text: string;
  size: number;
  weight: number;
  color: Fill;
  align: 'left' | 'center' | 'right';
  lh: number;
  hi?: string; // trecho em destaque
  hiStyle?: 'box' | 'gradient';
  hiColor?: string;
  hiInk?: string;
  ruled?: string; // cor das linhas de caderno sob o texto
  bg?: string; // fundo atrás do texto (etiquetas e botões)
  bgMode?: 'fit' | 'full';
  pad?: number;
  radius?: number;
};
export type RectLayer = { id: string; type: 'rect'; x: number; y: number; w: number; h: number; fill: Fill; radius?: number; stroke?: string };
export type ImageLayer = { id: string; type: 'image'; x: number; y: number; w: number; h: number; media: number; fit: 'cover' | 'contain'; radius?: number };
export type Layer = TextLayer | RectLayer | ImageLayer;
export type Scene = { w: number; h: number; bg: Fill; glow?: boolean; layers: Layer[] };

export const BRAND_GRADIENT = ['#3B6CF6', '#7C4DFF', '#E0458F', '#F08A24'];
export const mediaUrl = (id: number, thumb = false) => `/api/media/${id}${thumb ? '?thumb=1' : ''}`;

let seq = 0;
export const newId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

type Word = { t: string; hi: boolean };
export type Line = { words: Word[]; width: number };

export function tokenize(text: string, hi?: string): Word[][] {
  // Respeita quebras de linha que a pessoa digitou.
  const hiWords = (hi ?? '').split(/\s+/).filter(Boolean);
  const paragraphs = text.split('\n').map((p) => p.split(/\s+/).filter(Boolean).map((t) => ({ t, hi: false })));
  if (hiWords.length) {
    const flat = paragraphs.flat();
    for (let i = 0; i + hiWords.length <= flat.length; i++) {
      if (hiWords.every((h, k) => flat[i + k].t === h)) {
        for (let k = 0; k < hiWords.length; k++) flat[i + k].hi = true;
        break;
      }
    }
  }
  return paragraphs;
}

export function wrapWords(ctx: CanvasRenderingContext2D, paragraphs: Word[][], maxW: number): Line[] {
  const space = ctx.measureText(' ').width;
  const lines: Line[] = [];
  for (const words of paragraphs) {
    if (!words.length) {
      lines.push({ words: [], width: 0 });
      continue;
    }
    let cur: Word[] = [];
    let width = 0;
    for (const w of words) {
      const ww = ctx.measureText(w.t).width;
      const next = cur.length ? width + space + ww : ww;
      if (cur.length && next > maxW) {
        lines.push({ words: cur, width });
        cur = [w];
        width = ww;
      } else {
        cur.push(w);
        width = next;
      }
    }
    if (cur.length) lines.push({ words: cur, width });
  }
  return lines;
}

const fontOf = (l: TextLayer, family: string) => `${l.weight} ${l.size}px ${family}`;

/** Linhas e tamanho ocupado por uma camada de texto. */
export function layoutText(ctx: CanvasRenderingContext2D, l: TextLayer, family: string) {
  ctx.font = fontOf(l, family);
  const pad = l.bg ? l.pad ?? 0 : 0;
  const inner = Math.max(10, l.w - pad * 2);
  const lines = wrapWords(ctx, tokenize(l.text, l.hi), inner);
  const lineH = l.size * l.lh;
  const textH = Math.max(1, lines.length) * lineH;
  const maxLine = Math.max(0, ...lines.map((x) => x.width));
  const boxW = l.bg && l.bgMode !== 'full' ? Math.min(l.w, maxLine + pad * 2) : l.w;
  return { lines, lineH, textH, h: textH + pad * 2, boxW, pad, inner };
}

/** Maior tamanho de fonte (entre max e min) em que o texto cabe na caixa. */
export function fitSize(ctx: CanvasRenderingContext2D, base: Omit<TextLayer, 'size'>, family: string, maxH: number, max: number, min: number) {
  for (let size = max; size >= min; size -= 2) {
    const l = { ...base, size } as TextLayer;
    const { h, lines, inner } = layoutText(ctx, l, family);
    ctx.font = fontOf(l, family);
    if (h <= maxH && lines.every((x) => x.width <= inner + 0.5)) return size;
  }
  return min;
}

function fillStyle(ctx: CanvasRenderingContext2D, fill: Fill, x: number, y: number, w: number, h: number) {
  if (fill === 'brand') {
    const g = ctx.createLinearGradient(x, 0, x + Math.max(w, 1), 0);
    BRAND_GRADIENT.forEach((c, i) => g.addColorStop(i / (BRAND_GRADIENT.length - 1), c));
    return g;
  }
  if (fill === 'shade') {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0.86)');
    return g;
  }
  return fill;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, l: TextLayer, family: string) {
  const { lines, lineH, h, boxW, pad, inner } = layoutText(ctx, l, family);
  ctx.font = fontOf(l, family);
  const boxX = l.align === 'center' && l.bg && l.bgMode !== 'full' ? l.x + (l.w - boxW) / 2 : l.align === 'right' && l.bg && l.bgMode !== 'full' ? l.x + l.w - boxW : l.x;
  if (l.bg) {
    ctx.fillStyle = fillStyle(ctx, l.bg, boxX, l.y, boxW, h);
    roundRect(ctx, boxX, l.y, boxW, h, l.radius ?? 0);
    ctx.fill();
  }
  const space = ctx.measureText(' ').width;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    const top = l.y + pad + i * lineH;
    const base = top + l.size * 0.92 + (lineH - l.size * 1.1) / 2;
    if (l.ruled) {
      ctx.fillStyle = l.ruled;
      ctx.fillRect(l.x, top + lineH - 2, l.w, 2);
    }
    const innerX = l.bg && l.bgMode !== 'full' ? boxX + pad : l.x + pad;
    const innerW = l.bg && l.bgMode !== 'full' ? boxW - pad * 2 : inner;
    let cx = l.align === 'center' ? innerX + (innerW - line.width) / 2 : l.align === 'right' ? innerX + innerW - line.width : innerX;
    line.words.forEach((w, k) => {
      const ww = ctx.measureText(w.t).width;
      if (w.hi && l.hiStyle === 'box') {
        const next = line.words[k + 1];
        const extend = next?.hi ? space : 0;
        ctx.fillStyle = l.hiColor ?? '#FFD640';
        roundRect(ctx, cx - l.size * 0.12, base - l.size * 0.86, ww + extend + l.size * 0.24, l.size * 1.08, l.size * 0.14);
        ctx.fill();
        ctx.fillStyle = l.hiInk ?? '#121211';
      } else if (w.hi && l.hiStyle === 'gradient') {
        ctx.fillStyle = fillStyle(ctx, 'brand', cx, 0, ww, 0);
      } else {
        ctx.fillStyle = fillStyle(ctx, l.color, cx, top, ww, lineH);
      }
      ctx.fillText(w.t, cx, base);
      cx += ww + space;
    });
  });
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

const imageCache = new Map<number, Promise<HTMLImageElement | null>>();
export function loadMedia(id: number): Promise<HTMLImageElement | null> {
  let p = imageCache.get(id);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = mediaUrl(id);
    });
    imageCache.set(id, p);
  }
  return p;
}

export async function loadSceneImages(scene: Scene) {
  const ids = Array.from(new Set(scene.layers.filter((l): l is ImageLayer => l.type === 'image').map((l) => l.media)));
  const pairs = await Promise.all(ids.map(async (id) => [id, await loadMedia(id)] as const));
  return new Map(pairs.filter((p): p is readonly [number, HTMLImageElement] => !!p[1]));
}

function drawImage(ctx: CanvasRenderingContext2D, l: ImageLayer, img: HTMLImageElement | undefined) {
  ctx.save();
  roundRect(ctx, l.x, l.y, l.w, l.h, l.radius ?? 0);
  ctx.clip();
  if (!img) {
    ctx.fillStyle = 'rgba(128,128,128,0.25)';
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.restore();
    return;
  }
  const ir = img.naturalWidth / img.naturalHeight;
  const br = l.w / l.h;
  let dw = l.w;
  let dh = l.h;
  if ((l.fit === 'cover' && ir > br) || (l.fit === 'contain' && ir < br)) {
    dh = l.h;
    dw = l.h * ir;
  } else {
    dw = l.w;
    dh = l.w / ir;
  }
  ctx.drawImage(img, l.x + (l.w - dw) / 2, l.y + (l.h - dh) / 2, dw, dh);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Cena inteira
// ---------------------------------------------------------------------------

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, family: string, images: Map<number, HTMLImageElement>) {
  ctx.clearRect(0, 0, scene.w, scene.h);
  ctx.fillStyle = fillStyle(ctx, scene.bg, 0, 0, scene.w, scene.h);
  ctx.fillRect(0, 0, scene.w, scene.h);
  if (scene.glow) {
    const g = ctx.createRadialGradient(scene.w * 0.85, scene.h * 0.05, 0, scene.w * 0.85, scene.h * 0.05, scene.w * 0.9);
    g.addColorStop(0, 'rgba(124,77,255,0.28)');
    g.addColorStop(1, 'rgba(124,77,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, scene.w, scene.h);
  }
  for (const l of scene.layers) {
    if (l.type === 'rect') {
      ctx.fillStyle = fillStyle(ctx, l.fill, l.x, l.y, l.w, l.h);
      roundRect(ctx, l.x, l.y, l.w, l.h, l.radius ?? 0);
      ctx.fill();
      if (l.stroke) {
        ctx.strokeStyle = l.stroke;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    } else if (l.type === 'image') {
      drawImage(ctx, l, images.get(l.media));
    } else {
      drawText(ctx, l, family);
    }
  }
}

/** Retângulo ocupado por uma camada (para selecionar e arrastar no editor). */
export function boundsOf(ctx: CanvasRenderingContext2D, l: Layer, family: string) {
  if (l.type !== 'text') return { x: l.x, y: l.y, w: l.w, h: l.h };
  const { h, boxW } = layoutText(ctx, l, family);
  const x = l.bg && l.bgMode !== 'full' ? (l.align === 'center' ? l.x + (l.w - boxW) / 2 : l.align === 'right' ? l.x + l.w - boxW : l.x) : l.x;
  return { x, y: l.y, w: l.bg && l.bgMode !== 'full' ? boxW : l.w, h };
}

// ---------------------------------------------------------------------------
// Validação (o que vem do navegador antes de salvar)
// ---------------------------------------------------------------------------

const num = (v: unknown, min: number, max: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d);
const color = (v: unknown, d: string) => (typeof v === 'string' && (/^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgba?\([\d\s.,%]+\)$/.test(v) || v === 'brand' || v === 'shade') ? v : d);
const optColor = (v: unknown) => (v === undefined ? undefined : color(v, '#000000'));

export function sanitizeScene(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const w = num(r.w, 100, 2160, 1080);
  const h = num(r.h, 100, 3840, 1350);
  const layers: Layer[] = [];
  for (const x of Array.isArray(r.layers) ? r.layers.slice(0, 60) : []) {
    if (!x || typeof x !== 'object') continue;
    const l = x as Record<string, unknown>;
    const id = typeof l.id === 'string' ? l.id.slice(0, 40) : newId();
    const base = { id, x: num(l.x, -4000, 6000, 0), y: num(l.y, -4000, 6000, 0) };
    if (l.type === 'rect') {
      layers.push({ ...base, type: 'rect', w: num(l.w, 1, 6000, 100), h: num(l.h, 1, 6000, 100), fill: color(l.fill, '#000000'), radius: num(l.radius, 0, 2000, 0), stroke: optColor(l.stroke) });
    } else if (l.type === 'image') {
      if (!Number.isInteger(l.media)) continue;
      layers.push({ ...base, type: 'image', w: num(l.w, 1, 6000, 100), h: num(l.h, 1, 6000, 100), media: l.media as number, fit: l.fit === 'contain' ? 'contain' : 'cover', radius: num(l.radius, 0, 2000, 0) });
    } else if (l.type === 'text') {
      layers.push({
        ...base,
        type: 'text',
        w: num(l.w, 20, 6000, 600),
        text: typeof l.text === 'string' ? l.text.slice(0, 1200) : '',
        size: num(l.size, 8, 400, 48),
        weight: [400, 500, 600, 700, 800].includes(l.weight as number) ? (l.weight as number) : 700,
        color: color(l.color, '#000000'),
        align: l.align === 'center' || l.align === 'right' ? l.align : 'left',
        lh: num(l.lh, 0.8, 2.5, 1.2),
        hi: typeof l.hi === 'string' ? l.hi.slice(0, 200) : undefined,
        hiStyle: l.hiStyle === 'box' || l.hiStyle === 'gradient' ? l.hiStyle : undefined,
        hiColor: optColor(l.hiColor),
        hiInk: optColor(l.hiInk),
        ruled: optColor(l.ruled),
        bg: optColor(l.bg),
        bgMode: l.bgMode === 'full' ? 'full' : l.bgMode === 'fit' ? 'fit' : undefined,
        pad: l.pad === undefined ? undefined : num(l.pad, 0, 200, 0),
        radius: l.radius === undefined ? undefined : num(l.radius, 0, 400, 0),
      });
    }
  }
  return { w, h, bg: color(r.bg, '#FFFFFF'), glow: r.glow === true, layers };
}
