// Desenha as imagens dos posts no navegador (canvas), prontas para baixar em PNG.
// Só roda no cliente.

import { kindOf, type ImageStyle, type PostContent, type Story } from '@/lib/contentTypes';

export type Brand = { name: string; handle?: string; serie: string };
export type ImageSpec = { key: string; label: string; w: number; h: number; draw: (ctx: CanvasRenderingContext2D, font: string) => void };

type Palette = { bg: string; ink: string; muted: string; line: string; tagBg: string; tagInk: string; mark: string; markInk: string; accent: string; gradient: boolean };

const PALETTES: Record<ImageStyle, Palette> = {
  notas: { bg: '#121211', ink: '#F5F5F2', muted: '#8D8D88', line: '#2A2A27', tagBg: '#FFD640', tagInk: '#121211', mark: '#FFD640', markInk: '#121211', accent: '#F5B800', gradient: false },
  claro: { bg: '#F7F7F5', ink: '#0E0F12', muted: '#5E646C', line: '#E3E6EA', tagBg: '#0E0F12', tagInk: '#FFFFFF', mark: '', markInk: '', accent: '#7C4DFF', gradient: true },
  escuro: { bg: '#0E0F12', ink: '#FFFFFF', muted: '#9AA1AA', line: '#26282E', tagBg: '#FFFFFF', tagInk: '#0E0F12', mark: '', markInk: '', accent: '#A98BFF', gradient: true },
};

const GRAD = ['#3B6CF6', '#7C4DFF', '#E0458F', '#F08A24'];

// ---------------------------------------------------------------------------
// Texto: quebra de linha e ajuste de tamanho
// ---------------------------------------------------------------------------

type Word = { t: string; hi: boolean };
type Line = { words: Word[]; width: number };

function tokenize(text: string, destaque?: string): Word[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!destaque) return words.map((t) => ({ t, hi: false }));
  const hiWords = destaque.split(/\s+/).filter(Boolean);
  const out: Word[] = words.map((t) => ({ t, hi: false }));
  // marca a primeira sequência de palavras que bate com o destaque
  for (let i = 0; i + hiWords.length <= words.length; i++) {
    if (hiWords.every((h, k) => words[i + k] === h)) {
      for (let k = 0; k < hiWords.length; k++) out[i + k].hi = true;
      break;
    }
  }
  return out;
}

/** Destaca as últimas palavras (só palavras com letras, sem pegar pontuação solta). */
function tailHighlight(words: Word[], n = 2): Word[] {
  const out = words.map((w) => ({ ...w }));
  let marked = 0;
  for (let i = out.length - 1; i >= 0 && marked < n; i--) {
    if (!/[\p{L}\p{N}]/u.test(out[i].t)) break;
    out[i].hi = true;
    marked++;
  }
  return out;
}

function wrap(ctx: CanvasRenderingContext2D, words: Word[], maxW: number): Line[] {
  const space = ctx.measureText(' ').width;
  const lines: Line[] = [];
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
  return lines;
}

function fit(ctx: CanvasRenderingContext2D, words: Word[], font: string, weight: number, maxW: number, maxH: number, max: number, min: number, lh = 1.16) {
  for (let size = max; size >= min; size -= 2) {
    ctx.font = `${weight} ${size}px ${font}`;
    const lines = wrap(ctx, words, maxW);
    const tooWide = lines.some((l) => l.width > maxW);
    if (!tooWide && lines.length * size * lh <= maxH) return { size, lines, lh };
  }
  ctx.font = `${weight} ${min}px ${font}`;
  return { size: min, lines: wrap(ctx, words, maxW), lh };
}

function gradientFill(ctx: CanvasRenderingContext2D, x: number, w: number) {
  const g = ctx.createLinearGradient(x, 0, x + Math.max(w, 1), 0);
  GRAD.forEach((c, i) => g.addColorStop(i / (GRAD.length - 1), c));
  return g;
}

/** Desenha linhas de texto; palavras em destaque ganham marca-texto (notas) ou degradê (claro/escuro). */
function drawLines(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  block: { size: number; lines: Line[]; lh: number },
  x: number,
  y: number,
  opts: { color?: string; align?: 'left' | 'center'; boxW?: number; ruled?: boolean } = {},
) {
  const { size, lines, lh } = block;
  const space = ctx.measureText(' ').width;
  const lineH = size * lh;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    const baseY = y + i * lineH + size * 0.92;
    let cx = opts.align === 'center' && opts.boxW ? x + (opts.boxW - line.width) / 2 : x;
    if (opts.ruled) {
      ctx.fillStyle = p.line;
      ctx.fillRect(x, y + (i + 1) * lineH - 2, opts.boxW ?? 0, 2);
    }
    line.words.forEach((w, k) => {
      const ww = ctx.measureText(w.t).width;
      if (w.hi && p.mark) {
        const next = line.words[k + 1];
        const extend = next?.hi ? space : 0;
        ctx.fillStyle = p.mark;
        roundRect(ctx, cx - size * 0.12, baseY - size * 0.86, ww + extend + size * 0.24, size * 1.08, size * 0.14);
        ctx.fill();
        ctx.fillStyle = p.markInk;
      } else if (w.hi && p.gradient) {
        ctx.fillStyle = gradientFill(ctx, cx, ww);
      } else {
        ctx.fillStyle = opts.color ?? p.ink;
      }
      ctx.fillText(w.t, cx, baseY);
      cx += ww + space;
    });
  });
  return y + lines.length * lineH;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Peças comuns: fundo, topo, rodapé
// ---------------------------------------------------------------------------

function background(ctx: CanvasRenderingContext2D, p: Palette, style: ImageStyle, w: number, h: number) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);
  if (style === 'escuro') {
    const g = ctx.createRadialGradient(w * 0.85, h * 0.05, 0, w * 0.85, h * 0.05, w * 0.9);
    g.addColorStop(0, 'rgba(124,77,255,0.28)');
    g.addColorStop(1, 'rgba(124,77,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (style === 'claro') {
    ctx.fillStyle = gradientFill(ctx, 0, w);
    ctx.fillRect(0, 0, w, 14);
  }
}

function header(ctx: CanvasRenderingContext2D, p: Palette, style: ImageStyle, font: string, w: number, pad: number, tag: string, right: string) {
  let y = pad;
  if (style === 'notas') {
    ctx.font = `700 34px ${font}`;
    ctx.fillStyle = p.ink;
    ctx.textBaseline = 'top';
    ctx.fillText('7:30', pad, y);
    ctx.fillStyle = p.accent;
    const t = '‹ Notas';
    ctx.fillText(t, w - pad - ctx.measureText(t).width, y);
    y += 74;
  }
  // etiqueta da série
  ctx.font = `800 26px ${font}`;
  ctx.textBaseline = 'top';
  const tw = ctx.measureText(tag).width;
  ctx.fillStyle = p.tagBg;
  roundRect(ctx, pad, y, tw + 32, 46, 10);
  ctx.fill();
  ctx.fillStyle = p.tagInk;
  ctx.fillText(tag, pad + 16, y + 10);
  if (right) {
    ctx.font = `700 24px ${font}`;
    ctx.fillStyle = p.muted;
    const rw = ctx.measureText(right.toUpperCase()).width;
    ctx.fillText(right.toUpperCase(), Math.min(pad + tw + 52, w - pad - rw), y + 12);
  }
  return y + 46;
}

function footer(ctx: CanvasRenderingContext2D, p: Palette, font: string, w: number, h: number, pad: number, brand: Brand, right?: string) {
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 28px ${font}`;
  ctx.fillStyle = p.ink;
  ctx.fillText(brand.name, pad, h - pad - 30);
  if (brand.handle) {
    ctx.font = `600 24px ${font}`;
    ctx.fillStyle = p.muted;
    ctx.fillText(brand.handle, pad, h - pad + 4);
  }
  if (right) {
    ctx.font = `700 26px ${font}`;
    ctx.fillStyle = p.muted;
    ctx.fillText(right, w - pad - ctx.measureText(right).width, h - pad + 4);
  }
}

const serieTag = (n?: number) => (n ? `#${String(n).padStart(3, '0')}` : '#');

// ---------------------------------------------------------------------------
// Imagens por formato
// ---------------------------------------------------------------------------

function quoteImage(c: PostContent, style: ImageStyle, brand: Brand, serieNumero: number | undefined, prova: boolean): ImageSpec {
  const W = 1080;
  const H = 1350;
  return {
    key: 'imagem',
    label: prova ? 'Imagem de prova social' : 'Imagem de série',
    w: W,
    h: H,
    draw: (ctx, font) => {
      const p = PALETTES[style];
      const pad = 96;
      background(ctx, p, style, W, H);
      const top = header(ctx, p, style, font, W, pad, prova ? 'CLIENTE' : serieTag(serieNumero), brand.serie);
      const frase = c.imagem?.frase || c.gancho;
      const boxTop = top + 70;
      const boxH = H - boxTop - pad - 140;
      if (prova) {
        ctx.font = `800 200px ${font}`;
        ctx.fillStyle = p.gradient ? gradientFill(ctx, pad, 120) : p.mark;
        ctx.textBaseline = 'top';
        ctx.fillText('“', pad - 8, boxTop - 40);
      }
      const block = fit(ctx, tokenize(frase, c.imagem?.destaque), font, 800, W - pad * 2, boxH - (prova ? 120 : 0), 92, 44, 1.18);
      drawLines(ctx, p, block, pad, boxTop + (prova ? 120 : 0), { ruled: style === 'notas', boxW: W - pad * 2 });
      footer(ctx, p, font, W, H, pad, brand);
    },
  };
}

function carouselImages(c: PostContent, style: ImageStyle, brand: Brand): ImageSpec[] {
  const slides = c.slides ?? [];
  const W = 1080;
  const H = 1350;
  return slides.map((s, i) => ({
    key: `slide-${i + 1}`,
    label: `Slide ${i + 1}`,
    w: W,
    h: H,
    draw: (ctx, font) => {
      const p = PALETTES[style];
      const pad = 96;
      background(ctx, p, style, W, H);
      const first = i === 0;
      const last = i === slides.length - 1 && slides.length > 1;
      const top = header(ctx, p, style, font, W, pad, first ? brand.serie.toUpperCase() : `${i + 1}/${slides.length}`, '');
      let y = top + (first ? 110 : 80);
      const maxW = W - pad * 2;
      const titleBlock = fit(ctx, first ? tailHighlight(tokenize(s.titulo)) : tokenize(s.titulo), font, 800, maxW, first ? 520 : 360, first ? 104 : 80, 48, 1.12);
      y = drawLines(ctx, p, titleBlock, pad, y);
      if (s.texto) {
        y += 40;
        const textBlock = fit(ctx, tokenize(s.texto), font, 600, maxW, H - y - pad - 160, first ? 44 : 50, 30, 1.38);
        drawLines(ctx, p, textBlock, pad, y, { color: first ? p.muted : p.ink });
      }
      const right = first ? 'Arraste →' : last ? 'Salve este post' : `${i + 1}/${slides.length}`;
      footer(ctx, p, font, W, H, pad, brand, right);
    },
  }));
}

function coverImage(c: PostContent, style: ImageStyle, brand: Brand): ImageSpec {
  const W = 1080;
  const H = 1920;
  return {
    key: 'capa',
    label: 'Capa do vídeo',
    w: W,
    h: H,
    draw: (ctx, font) => {
      const p = PALETTES[style];
      const pad = 110;
      background(ctx, p, style, W, H);
      header(ctx, p, style, font, W, pad + 140, brand.serie.toUpperCase(), '');
      const capa = c.roteiro?.capa || c.gancho;
      const words = tailHighlight(tokenize(capa));
      const block = fit(ctx, words, font, 800, W - pad * 2, 900, 132, 64, 1.12);
      const blockH = block.lines.length * block.size * block.lh;
      drawLines(ctx, p, block, pad, (H - blockH) / 2, { align: 'center', boxW: W - pad * 2 });
      footer(ctx, p, font, W, H, pad, brand);
    },
  };
}

function storyImages(c: PostContent, style: ImageStyle, brand: Brand): ImageSpec[] {
  const stories = c.stories ?? [];
  const W = 1080;
  const H = 1920;
  return stories.map((s: Story, i) => ({
    key: `story-${i + 1}`,
    label: `Story ${i + 1}`,
    w: W,
    h: H,
    draw: (ctx, font) => {
      const p = PALETTES[style];
      const pad = 110;
      background(ctx, p, style, W, H);
      // barrinhas de progresso dos stories
      const bw = (W - pad * 2 - (stories.length - 1) * 10) / stories.length;
      stories.forEach((_, k) => {
        ctx.fillStyle = k <= i ? p.ink : p.line;
        roundRect(ctx, pad + k * (bw + 10), 70, bw, 8, 4);
        ctx.fill();
      });
      const maxW = W - pad * 2;
      const block = fit(ctx, tokenize(s.texto), font, 800, maxW, 700, 96, 48, 1.16);
      const blockH = block.lines.length * block.size * block.lh;
      let y = s.tipo === 'texto' ? (H - blockH) / 2 : H * 0.28;
      y = drawLines(ctx, p, block, pad, y, { align: 'center', boxW: maxW });
      y += 70;
      ctx.textBaseline = 'middle';
      if (s.tipo === 'enquete') {
        const opts = s.opcoes ?? ['Sim', 'Não'];
        opts.forEach((o, k) => {
          ctx.fillStyle = style === 'claro' ? '#FFFFFF' : 'rgba(255,255,255,0.08)';
          roundRect(ctx, pad, y + k * 150, maxW, 120, 60);
          ctx.fill();
          ctx.strokeStyle = p.line;
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.font = `800 46px ${font}`;
          ctx.fillStyle = p.ink;
          ctx.fillText(o, pad + (maxW - ctx.measureText(o).width) / 2, y + k * 150 + 62);
        });
      } else if (s.tipo === 'caixinha') {
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, pad, y, maxW, 260, 40);
        ctx.fill();
        ctx.fillStyle = gradientFill(ctx, pad, maxW);
        roundRect(ctx, pad, y, maxW, 90, 40);
        ctx.fill();
        ctx.fillRect(pad, y + 50, maxW, 40);
        ctx.font = `700 34px ${font}`;
        ctx.fillStyle = '#FFFFFF';
        const t = 'Faça uma pergunta';
        ctx.fillText(t, pad + (maxW - ctx.measureText(t).width) / 2, y + 46);
        ctx.font = `600 38px ${font}`;
        ctx.fillStyle = '#9AA1AA';
        const t2 = 'Escreva aqui…';
        ctx.fillText(t2, pad + (maxW - ctx.measureText(t2).width) / 2, y + 175);
      } else if (s.tipo === 'link') {
        const t = '🔗  Toque no link';
        ctx.font = `800 44px ${font}`;
        const tw = ctx.measureText(t).width + 100;
        ctx.fillStyle = '#FFFFFF';
        roundRect(ctx, (W - tw) / 2, y, tw, 110, 55);
        ctx.fill();
        ctx.fillStyle = '#2448C8';
        ctx.fillText(t, (W - tw) / 2 + 50, y + 57);
      }
      footer(ctx, p, font, W, H, pad, brand);
    },
  }));
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

export async function renderImage(spec: ImageSpec): Promise<HTMLCanvasElement> {
  const font = await brandFont();
  const canvas = document.createElement('canvas');
  canvas.width = spec.w;
  canvas.height = spec.h;
  const ctx = canvas.getContext('2d')!;
  spec.draw(ctx, font);
  return canvas;
}

export async function downloadImage(spec: ImageSpec, fileName: string) {
  const canvas = await renderImage(spec);
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
