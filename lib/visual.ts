// Identidade visual de cada pessoa: a IA monta a partir da entrevista e das referências (lib/visualAI.ts)
// e cada post sai numa variação dela (layout, fundo e cor diferentes, sempre na mesma linguagem).
// Sem dependências de servidor: usado também no navegador para desenhar as imagens (lib/postImage.ts).

export type FontKey = 'sans' | 'grotesk' | 'serif' | 'display' | 'mono';
export const FONT_KEYS: FontKey[] = ['sans', 'grotesk', 'serif', 'display', 'mono'];
/** Nome amigável de cada fonte (para a IA e para a tela). */
export const FONT_LABELS: Record<FontKey, string> = {
  sans: 'Manrope (sem serifa, limpa e moderna)',
  grotesk: 'Space Grotesk (geométrica, tech, contemporânea)',
  serif: 'Playfair Display (serifada elegante, editorial, sofisticada)',
  display: 'Anton (condensada, impacto, pôster, sempre em caixa alta)',
  mono: 'JetBrains Mono (monoespaçada, técnica, dados, código)',
};

export type Layout = 'editorial' | 'poster' | 'cartao' | 'split' | 'minimal' | 'manchete' | 'citacao' | 'revista';
export const LAYOUTS: Layout[] = ['editorial', 'poster', 'cartao', 'split', 'minimal', 'manchete', 'citacao', 'revista'];
export const LAYOUT_LABELS: Record<Layout, string> = {
  editorial: 'Editorial: etiqueta em cima, título grande alinhado, linhas finas e assinatura embaixo',
  poster: 'Pôster: texto enorme ocupando a peça, contraste forte, destaque em bloco de cor',
  cartao: 'Cartão: fundo com textura ou degradê e um cartão central com a frase, como um post salvo',
  split: 'Dividido: bloco de cor (ou a foto) na parte de cima e o texto embaixo',
  minimal: 'Minimalista: muito respiro, frase média centralizada, um detalhe de cor',
  manchete: 'Manchete: cara de jornal ou revista, cabeçalho com o nome, filetes e título serifado',
  citacao: 'Citação: aspas grandes na cor de destaque, frase e assinatura',
  revista: 'Revista: forma geométrica grande num canto, etiqueta e texto ancorado embaixo',
};

export type Background = 'solido' | 'gradiente' | 'radial' | 'grade' | 'pontos' | 'listras';
export type Highlight = 'gradiente' | 'caixa' | 'pincel' | 'sublinhado' | 'cor';
export type Shape = 'nenhuma' | 'circulo' | 'arco' | 'barra' | 'moldura';
/** Variação de cor do post: as cores-base, invertidas ou com o fundo na cor de destaque. */
export type Mode = 'base' | 'invertido' | 'acento';

export type Visual = {
  nome: string;
  layouts: Layout[];
  layout: Layout;
  titulo: FontKey;
  texto: FontKey;
  peso: 600 | 700 | 800;
  caixaAlta: boolean;
  cores: { fundo: string; fundo2: string; tinta: string; suave: string; acento: string; acento2: string };
  fundo: Background;
  destaque: Highlight;
  forma: Shape;
  raio: number;
  alinhamento: 'left' | 'center';
  modo: Mode;
  /** Varia detalhes (posição da forma, ângulo do degradê) de um post para outro. */
  semente: number;
};

// ---------------------------------------------------------------------------
// Cores
// ---------------------------------------------------------------------------

const HEX = /^#([0-9a-fA-F]{6})$/;
const hex = (v: unknown, d: string) => {
  if (typeof v !== 'string') return d;
  const s = v.trim();
  if (HEX.test(s)) return s.toUpperCase();
  const m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toUpperCase() : d;
};

function lum(h: string) {
  const n = parseInt(h.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Tinta legível sobre um fundo: a preferida, se der contraste, senão quase-preto ou branco. */
export function readable(bg: string, prefer?: string, min = 4.5) {
  if (prefer && contrast(bg, prefer) >= min) return prefer;
  return contrast(bg, '#111111') >= contrast(bg, '#FFFFFF') ? '#111111' : '#FFFFFF';
}
export const isDark = (h: string) => lum(h) < 0.2;
/** Mistura duas cores (t = 0 → a, 1 → b). */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Validação (o que vem da IA ou do navegador)
// ---------------------------------------------------------------------------

const pick = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

export const DEFAULT_VISUAL: Visual = {
  nome: 'Editorial grafite',
  layouts: ['editorial', 'minimal', 'citacao'],
  layout: 'editorial',
  titulo: 'sans',
  texto: 'sans',
  peso: 800,
  caixaAlta: false,
  cores: { fundo: '#F5F3EE', fundo2: '#E9E4DA', tinta: '#151515', suave: '#5F5A52', acento: '#C2512F', acento2: '#1F3A5F' },
  fundo: 'solido',
  destaque: 'sublinhado',
  forma: 'barra',
  raio: 24,
  alinhamento: 'left',
  modo: 'base',
  semente: 0,
};

export function sanitizeVisual(raw: unknown): Visual | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const c = (r.cores && typeof r.cores === 'object' ? r.cores : {}) as Record<string, unknown>;
  const d = DEFAULT_VISUAL;
  const layouts = (Array.isArray(r.layouts) ? r.layouts : []).filter((l): l is Layout => LAYOUTS.includes(l as Layout));
  const uniq = Array.from(new Set(layouts)).slice(0, 4);
  const layout = pick(r.layout, LAYOUTS, uniq[0] ?? d.layout);
  const fundo = hex(c.fundo, d.cores.fundo);
  const tinta = readable(fundo, hex(c.tinta, d.cores.tinta));
  const acento = hex(c.acento, d.cores.acento);
  const v: Visual = {
    nome: typeof r.nome === 'string' && r.nome.trim() ? r.nome.trim().slice(0, 40) : d.nome,
    layouts: uniq.length ? uniq : [layout],
    layout,
    titulo: pick(r.titulo, FONT_KEYS, d.titulo),
    texto: pick(r.texto, FONT_KEYS, d.texto),
    peso: r.peso === 600 || r.peso === 700 ? r.peso : 800,
    caixaAlta: r.caixaAlta === true,
    cores: {
      fundo,
      fundo2: hex(c.fundo2, mix(fundo, acento, 0.12)),
      tinta,
      suave: readable(fundo, hex(c.suave, mix(tinta, fundo, 0.35)), 3),
      acento,
      acento2: hex(c.acento2, d.cores.acento2),
    },
    fundo: pick(r.fundo, ['solido', 'gradiente', 'radial', 'grade', 'pontos', 'listras'] as const, d.fundo),
    destaque: pick(r.destaque, ['gradiente', 'caixa', 'pincel', 'sublinhado', 'cor'] as const, d.destaque),
    forma: pick(r.forma, ['nenhuma', 'circulo', 'arco', 'barra', 'moldura'] as const, d.forma),
    raio: typeof r.raio === 'number' && Number.isFinite(r.raio) ? Math.max(0, Math.min(48, Math.round(r.raio))) : d.raio,
    alinhamento: r.alinhamento === 'center' ? 'center' : 'left',
    modo: pick(r.modo, ['base', 'invertido', 'acento'] as const, 'base'),
    semente: typeof r.semente === 'number' && Number.isFinite(r.semente) ? Math.abs(Math.round(r.semente)) % 1000 : 0,
  };
  if (!v.layouts.includes(v.layout)) v.layouts = [v.layout, ...v.layouts].slice(0, 4);
  // Anton só existe em caixa alta e peso único.
  if (v.titulo === 'display') v.caixaAlta = true;
  if (v.texto === 'display') v.texto = 'sans';
  return v;
}

// ---------------------------------------------------------------------------
// Variação por post
// ---------------------------------------------------------------------------

/** Paleta pronta para desenhar, já com a variação de cor (modo) aplicada e legível. */
export function paletteOf(v: Visual) {
  const { fundo, fundo2, tinta, suave, acento, acento2 } = v.cores;
  if (v.modo === 'invertido' && contrast(tinta, fundo) >= 4.5) {
    const bg = tinta;
    const ink = fundo;
    return { bg, bg2: mix(bg, acento, 0.18), ink, muted: readable(bg, mix(ink, bg, 0.3), 3), accent: readable(bg, acento, 3) === acento ? acento : acento2, accent2: acento2, onAccent: readable(acento) };
  }
  if (v.modo === 'acento') {
    const bg = acento;
    const ink = readable(bg, contrast(bg, fundo) >= 4.5 ? fundo : tinta);
    const accent2 = contrast(bg, acento2) >= 3 ? acento2 : ink;
    return { bg, bg2: mix(bg, '#000000', 0.12), ink, muted: readable(bg, mix(ink, bg, 0.25), 3), accent: accent2, accent2, onAccent: readable(accent2) };
  }
  return { bg: fundo, bg2: fundo2, ink: tinta, muted: suave, accent: readable(fundo, acento, 2.2) === acento ? acento : acento2, accent2: acento2, onAccent: readable(acento) };
}

/**
 * Variação do visual da marca para o post n: alterna os layouts que combinam com a marca
 * e a cor do fundo, para que cada post saia diferente sem perder a identidade.
 */
export function variantFor(base: Visual, n: number): Visual {
  const layouts = base.layouts.length ? base.layouts : [base.layout];
  const layout = layouts[n % layouts.length];
  // Modos seguros: invertido só se a tinta servir de fundo; acento só se tiver contraste para texto.
  const modes: Mode[] = ['base'];
  if (contrast(base.cores.tinta, base.cores.fundo) >= 4.5 && n % 3 === 2) modes.push('invertido');
  if (n % 4 === 3) modes.push('acento');
  const modo = modes[modes.length - 1];
  return { ...base, layout, modo, semente: (n * 37 + 11) % 1000 };
}

/** Próxima variação local (sem IA): troca layout e cor, para o botão "Outro layout". */
export function nextVariant(v: Visual): Visual {
  const all = Array.from(new Set([...v.layouts, ...LAYOUTS]));
  const i = all.indexOf(v.layout);
  const layout = all[(i + 1) % all.length];
  const order: Mode[] = ['base', 'invertido', 'acento'];
  const modo = layout === v.layouts[0] ? order[(order.indexOf(v.modo) + 1) % order.length] : v.modo;
  return { ...v, layout, modo, semente: (v.semente + 173) % 1000 };
}
