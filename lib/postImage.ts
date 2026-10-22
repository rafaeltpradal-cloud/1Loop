// Monta as imagens dos posts como cenas editáveis (lib/scene) e gera os PNGs no navegador.

import { kindOf, type ImageStyle, type PostContent, type Story } from '@/lib/contentTypes';
import { drawScene, fitSize, layoutText, loadSceneImages, newId, type Layer, type Scene, type TextLayer } from '@/lib/scene';

export type Brand = { name: string; handle?: string; serie: string };
export type ImageSpec = { key: string; label: string; w: number; h: number; build: (ctx: CanvasRenderingContext2D, font: string) => Scene };

type Palette = { bg: string; ink: string; muted: string; line: string; tagBg: string; tagInk: string; hiStyle: 'box' | 'gradient'; accent: string; glow?: boolean; topBar?: boolean };

const PALETTES: Record<ImageStyle, Palette> = {
  notas: { bg: '#121211', ink: '#F5F5F2', muted: '#8D8D88', line: '#2A2A27', tagBg: '#FFD640', tagInk: '#121211', hiStyle: 'box', accent: '#F5B800' },
  claro: { bg: '#F7F7F5', ink: '#0E0F12', muted: '#5E646C', line: '#E3E6EA', tagBg: '#0E0F12', tagInk: '#FFFFFF', hiStyle: 'gradient', accent: '#7C4DFF', topBar: true },
  escuro: { bg: '#0E0F12', ink: '#FFFFFF', muted: '#9AA1AA', line: '#26282E', tagBg: '#FFFFFF', tagInk: '#0E0F12', hiStyle: 'gradient', accent: '#A98BFF', glow: true },
};

// Com foto de fundo, o texto fica claro sobre a sombra.
const onPhoto = (p: Palette): Palette => ({ ...p, ink: '#FFFFFF', muted: 'rgba(255,255,255,0.82)', line: 'rgba(255,255,255,0.22)', glow: false, topBar: false });

const lastWords = (t: string, n = 2) => {
  const words = t.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = words.length - 1; i >= 0 && out.length < n; i--) {
    if (!/[\p{L}\p{N}]/u.test(words[i])) break;
    out.unshift(words[i]);
  }
  return out.join(' ');
};

function text(p: Partial<TextLayer> & Pick<TextLayer, 'x' | 'y' | 'w' | 'text'>): TextLayer {
  return { id: newId(), type: 'text', size: 40, weight: 700, color: '#000000', align: 'left', lh: 1.2, ...p };
}

type Ctx = { ctx: CanvasRenderingContext2D; font: string; W: number; H: number; pad: number; p: Palette; style: ImageStyle };

function base(c: Ctx, photo?: number): Layer[] {
  const layers: Layer[] = [];
  if (photo) {
    layers.push({ id: newId(), type: 'image', x: 0, y: 0, w: c.W, h: c.H, media: photo, fit: 'cover' });
    layers.push({ id: newId(), type: 'rect', x: 0, y: c.H * 0.28, w: c.W, h: c.H * 0.72, fill: 'shade' });
  }
  if (c.p.topBar) layers.push({ id: newId(), type: 'rect', x: 0, y: 0, w: c.W, h: 14, fill: 'brand' });
  return layers;
}

/** Barra do bloco de notas (só no estilo notas) + etiqueta da série. Devolve o y logo abaixo. */
function header(c: Ctx, layers: Layer[], tag: string, right: string, top = c.pad, notes = true) {
  let y = top;
  if (c.style === 'notas' && notes) {
    layers.push(text({ x: c.pad, y, w: c.W - c.pad * 2, text: '7:30', size: 34, weight: 700, color: c.p.ink }));
    layers.push(text({ x: c.pad, y, w: c.W - c.pad * 2, text: '‹ Notas', size: 34, weight: 700, color: c.p.accent, align: 'right' }));
    y += 74;
  }
  if (tag) {
    const t = text({ x: c.pad, y, w: c.W - c.pad * 2, text: tag, size: 26, weight: 800, color: c.p.tagInk, bg: c.p.tagBg, bgMode: 'fit', pad: 12, radius: 10, lh: 1.15 });
    layers.push(t);
    const box = layoutText(c.ctx, t, c.font);
    if (right) layers.push(text({ x: c.pad + box.boxW + 20, y: y + 13, w: c.W - c.pad * 2 - box.boxW - 20, text: right.toUpperCase(), size: 24, weight: 700, color: c.p.muted }));
    y += box.h;
  }
  return y;
}

function footer(c: Ctx, layers: Layer[], brand: Brand, right?: string) {
  const y = c.H - c.pad - 58;
  layers.push(text({ x: c.pad, y, w: c.W * 0.6, text: brand.name, size: 28, weight: 800, color: c.p.ink, lh: 1.1 }));
  if (brand.handle) layers.push(text({ x: c.pad, y: y + 34, w: c.W * 0.62, text: brand.handle, size: 24, weight: 600, color: c.p.muted, lh: 1.1 }));
  if (right) layers.push(text({ x: c.W * 0.55, y: y + 34, w: c.W * 0.45 - c.pad, text: right, size: 26, weight: 700, color: c.p.muted, align: 'right', lh: 1.1 }));
}

/** Texto principal ajustado à caixa; com foto, encosta no rodapé. */
function mainText(c: Ctx, layers: Layer[], str: string, hi: string | undefined, top: number, bottom: number, max: number, min: number, opts: { align?: TextLayer['align']; ruled?: boolean; anchor?: 'top' | 'center' | 'bottom'; weight?: number; color?: string; lh?: number } = {}) {
  const partial = {
    id: newId(),
    type: 'text' as const,
    x: c.pad,
    y: top,
    w: c.W - c.pad * 2,
    text: str,
    weight: opts.weight ?? 800,
    color: opts.color ?? c.p.ink,
    align: opts.align ?? 'left',
    lh: opts.lh ?? 1.16,
    hi: hi || undefined,
    hiStyle: c.p.hiStyle,
    ruled: opts.ruled ? c.p.line : undefined,
  };
  const size = fitSize(c.ctx, partial, c.font, bottom - top, max, min);
  const layer: TextLayer = { ...partial, size };
  const { h } = layoutText(c.ctx, layer, c.font);
  if (opts.anchor === 'bottom') layer.y = bottom - h;
  if (opts.anchor === 'center') layer.y = top + (bottom - top - h) / 2;
  layers.push(layer);
  return layer.y + h;
}

const serieTag = (n?: number) => (n ? `#${String(n).padStart(3, '0')}` : '#');

// ---------------------------------------------------------------------------
// Imagens por formato
// ---------------------------------------------------------------------------

function quoteImage(c0: PostContent, style: ImageStyle, brand: Brand, serieNumero: number | undefined, prova: boolean): ImageSpec {
  const W = 1080;
  const H = 1350;
  return {
    key: 'imagem',
    label: prova ? 'Imagem de prova social' : 'Imagem de série',
    w: W,
    h: H,
    build: (ctx, font) => {
      const photo = c0.foto;
      const p = photo ? onPhoto(PALETTES[style]) : PALETTES[style];
      const c: Ctx = { ctx, font, W, H, pad: 96, p, style };
      const layers = base(c, photo);
      const top = header(c, layers, prova ? 'CLIENTE' : serieTag(serieNumero), brand.serie, c.pad, !photo);
      const frase = c0.imagem?.frase || c0.gancho;
      let start = top + 70;
      if (prova && !photo) {
        layers.push(text({ x: c.pad - 8, y: start - 40, w: 200, text: '“', size: 200, weight: 800, color: p.hiStyle === 'box' ? '#FFD640' : 'brand', lh: 1 }));
        start += 120;
      }
      mainText(c, layers, frase, prova ? undefined : c0.imagem?.destaque, photo ? H * 0.42 : start, H - c.pad - 140, 92, 44, { ruled: style === 'notas' && !photo, anchor: photo ? 'bottom' : 'top', lh: 1.18 });
      footer(c, layers, brand);
      return { w: W, h: H, bg: p.bg, glow: p.glow, layers };
    },
  };
}

function carouselImages(c0: PostContent, style: ImageStyle, brand: Brand): ImageSpec[] {
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
      const photo = first ? c0.foto : undefined;
      const p = photo ? onPhoto(PALETTES[style]) : PALETTES[style];
      const c: Ctx = { ctx, font, W, H, pad: 96, p, style };
      const layers = base(c, photo);
      const top = header(c, layers, first ? brand.serie.toUpperCase() : `${i + 1}/${slides.length}`, '', c.pad, !photo);
      const bottom = H - c.pad - 150;
      if (photo) {
        // capa com foto: título e apoio encostados no rodapé
        const subH = s.texto ? 150 : 0;
        mainText(c, layers, s.titulo, lastWords(s.titulo), H * 0.4, bottom - subH, 104, 48, { anchor: 'bottom', lh: 1.12 });
        if (s.texto) layers.push(text({ x: c.pad, y: bottom - subH + 30, w: W - c.pad * 2, text: s.texto, size: 38, weight: 600, color: p.muted, lh: 1.35 }));
      } else {
        const titleEnd = mainText(c, layers, s.titulo, first ? lastWords(s.titulo) : undefined, top + (first ? 110 : 80), top + (first ? 630 : 440), first ? 104 : 80, 48, { lh: 1.12 });
        if (s.texto) mainText(c, layers, s.texto, undefined, titleEnd + 40, bottom, first ? 44 : 50, 30, { weight: 600, color: first ? p.muted : p.ink, lh: 1.38 });
      }
      footer(c, layers, brand, first ? 'Arraste →' : last ? 'Salve este post' : `${i + 1}/${slides.length}`);
      return { w: W, h: H, bg: p.bg, glow: p.glow, layers };
    },
  }));
}

function coverImage(c0: PostContent, style: ImageStyle, brand: Brand): ImageSpec {
  const W = 1080;
  const H = 1920;
  return {
    key: 'capa',
    label: 'Capa do vídeo',
    w: W,
    h: H,
    build: (ctx, font) => {
      const photo = c0.foto;
      const p = photo ? onPhoto(PALETTES[style]) : PALETTES[style];
      const c: Ctx = { ctx, font, W, H, pad: 110, p, style };
      const layers = base(c, photo);
      header(c, layers, brand.serie.toUpperCase(), '', c.pad + 140, false);
      const capa = c0.roteiro?.capa || c0.gancho;
      if (photo) mainText(c, layers, capa, lastWords(capa), H * 0.45, H - c.pad - 200, 132, 64, { align: 'center', anchor: 'bottom', lh: 1.12 });
      else mainText(c, layers, capa, lastWords(capa), H * 0.25, H * 0.75, 132, 64, { align: 'center', anchor: 'center', lh: 1.12 });
      footer(c, layers, brand);
      return { w: W, h: H, bg: p.bg, glow: p.glow, layers };
    },
  };
}

function storyImages(c0: PostContent, style: ImageStyle, brand: Brand): ImageSpec[] {
  const stories = c0.stories ?? [];
  const W = 1080;
  const H = 1920;
  return stories.map((s: Story, i) => ({
    key: `story-${i + 1}`,
    label: `Story ${i + 1}`,
    w: W,
    h: H,
    build: (ctx, font) => {
      const photo = i === 0 ? c0.foto : undefined;
      const p = photo ? onPhoto(PALETTES[style]) : PALETTES[style];
      const c: Ctx = { ctx, font, W, H, pad: 110, p, style };
      const layers = base(c, photo);
      const maxW = W - c.pad * 2;
      const bw = (maxW - (stories.length - 1) * 10) / stories.length;
      stories.forEach((_, k) => layers.push({ id: newId(), type: 'rect', x: c.pad + k * (bw + 10), y: 70, w: bw, h: 8, radius: 4, fill: k <= i ? p.ink : p.line }));

      let y: number;
      if (s.tipo === 'texto') y = mainText(c, layers, s.texto, undefined, H * 0.22, H * 0.78, 96, 48, { align: 'center', anchor: photo ? 'bottom' : 'center' });
      else y = mainText(c, layers, s.texto, undefined, H * 0.24, H * 0.5, 96, 48, { align: 'center', anchor: 'bottom' });
      y += 70;

      const card = style === 'claro' ? '#FFFFFF' : 'rgba(255,255,255,0.10)';
      if (s.tipo === 'enquete') {
        (s.opcoes ?? ['Sim', 'Não']).forEach((o, k) => {
          layers.push({ id: newId(), type: 'rect', x: c.pad, y: y + k * 150, w: maxW, h: 120, radius: 60, fill: card, stroke: p.line });
          layers.push(text({ x: c.pad, y: y + k * 150 + 32, w: maxW, text: o, size: 46, weight: 800, color: p.ink, align: 'center', lh: 1.2 }));
        });
      } else if (s.tipo === 'caixinha') {
        layers.push({ id: newId(), type: 'rect', x: c.pad, y, w: maxW, h: 260, radius: 40, fill: '#FFFFFF' });
        layers.push({ id: newId(), type: 'rect', x: c.pad, y, w: maxW, h: 90, radius: 40, fill: 'brand' });
        layers.push({ id: newId(), type: 'rect', x: c.pad, y: y + 50, w: maxW, h: 40, fill: 'brand' });
        layers.push(text({ x: c.pad, y: y + 24, w: maxW, text: 'Faça uma pergunta', size: 34, weight: 700, color: '#FFFFFF', align: 'center', lh: 1.2 }));
        layers.push(text({ x: c.pad, y: y + 150, w: maxW, text: 'Escreva aqui…', size: 38, weight: 600, color: '#9AA1AA', align: 'center', lh: 1.2 }));
      } else if (s.tipo === 'link') {
        layers.push(text({ x: c.pad, y, w: maxW, text: '🔗  Toque no link', size: 44, weight: 800, color: '#2448C8', align: 'center', bg: '#FFFFFF', bgMode: 'fit', pad: 32, radius: 56, lh: 1.2 }));
      }
      footer(c, layers, brand);
      return { w: W, h: H, bg: p.bg, glow: p.glow, layers };
    },
  }));
}

function photoImage(c0: PostContent, style: ImageStyle): ImageSpec {
  const W = 1080;
  const H = 1350;
  return {
    key: 'foto',
    label: 'Foto do post',
    w: W,
    h: H,
    build: () => ({ w: W, h: H, bg: PALETTES[style].bg, layers: c0.foto ? [{ id: newId(), type: 'image', x: 0, y: 0, w: W, h: H, media: c0.foto, fit: 'cover' }] : [] }),
  };
}

/** Todas as imagens de um post, na ordem de publicação. */
export function imagesFor(formato: string, c: PostContent, brand: Brand, serieNumero?: number): ImageSpec[] {
  const style = c.estilo ?? 'notas';
  const kind = kindOf(formato);
  if (kind === 'carrossel') return carouselImages(c, style, brand);
  if (kind === 'imagem') return [quoteImage(c, style, brand, serieNumero, false)];
  if (kind === 'prova') return [quoteImage(c, style, brand, serieNumero, true)];
  if (kind === 'video') return [coverImage(c, style, brand)];
  if (kind === 'stories') return storyImages(c, style, brand);
  if (c.foto) return [photoImage(c, style)]; // texto ou thread com foto
  return [];
}

let fontReady: Promise<string> | null = null;
/** Fonte da marca (Manrope) já carregada para o canvas. */
export function brandFont(): Promise<string> {
  if (!fontReady) {
    fontReady = (async () => {
      const fam = getComputedStyle(document.body).fontFamily || 'sans-serif';
      try {
        await Promise.all([document.fonts.load(`800 80px ${fam}`), document.fonts.load(`600 40px ${fam}`), document.fonts.load(`700 30px ${fam}`)]);
      } catch {
        // segue com a fonte que tiver
      }
      return fam;
    })();
  }
  return fontReady;
}

let measurer: CanvasRenderingContext2D | null = null;
export function measureCtx() {
  if (!measurer) measurer = document.createElement('canvas').getContext('2d')!;
  return measurer;
}

/** Cena final de uma imagem: a editada no canvas (se houver) ou o modelo. */
export async function sceneFor(spec: ImageSpec, c: PostContent): Promise<Scene> {
  const font = await brandFont();
  return c.canvas?.[spec.key] ?? spec.build(measureCtx(), font);
}

export async function renderScene(scene: Scene): Promise<HTMLCanvasElement> {
  const font = await brandFont();
  const images = await loadSceneImages(scene);
  const canvas = document.createElement('canvas');
  canvas.width = scene.w;
  canvas.height = scene.h;
  drawScene(canvas.getContext('2d')!, scene, font, images);
  return canvas;
}

export async function renderImage(spec: ImageSpec, c: PostContent): Promise<HTMLCanvasElement> {
  return renderScene(await sceneFor(spec, c));
}

export async function downloadImage(spec: ImageSpec, c: PostContent, fileName: string) {
  const canvas = await renderImage(spec, c);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
