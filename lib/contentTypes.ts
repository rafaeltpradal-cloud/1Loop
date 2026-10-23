// Tipos e utilitários dos conteúdos, sem dependências de servidor (usados também no navegador).
import type { Scene as CanvasScene } from '@/lib/scene';

export type ImageStyle = 'notas' | 'claro' | 'escuro';
export const IMAGE_STYLES: { id: ImageStyle; nome: string }[] = [
  { id: 'notas', nome: 'Bloco de notas' },
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
];

export type Slide = { titulo: string; texto: string };
export type ScriptScene = { fala: string; visual: string };
export type Story = { tipo: 'texto' | 'enquete' | 'caixinha' | 'link'; texto: string; opcoes?: string[] };

export type PostContent = {
  gancho: string; // primeira frase / título
  legenda: string; // texto pronto para colar na rede
  hashtags: string[];
  cta: string;
  slides?: Slide[]; // carrossel
  imagem?: { frase: string; destaque?: string }; // imagem de série e prova social
  roteiro?: { duracao: string; capa: string; cenas: ScriptScene[] }; // reels / tiktok / shorts
  stories?: Story[];
  partes?: string[]; // thread
  dica?: string; // dica de publicação
  estilo?: ImageStyle;
  foto?: number; // id da foto (biblioteca) usada no post
  video?: number; // id do vídeo (biblioteca) para reels
  canvas?: Record<string, CanvasScene>; // imagens editadas no editor visual (Pro e Multi), por imagem
  ajustes?: number; // pedidos de ajuste feitos à IA neste post (só o servidor grava)
};

export type MediaItem = { id: number; kind: 'foto' | 'referencia' | 'video'; width: number | null; height: number | null; duration_s?: number | null };
export const MEDIA_COLUMNS = 'id, kind, width, height, duration_s';

export type PostRow = {
  id: number;
  strategy_id: number;
  item_index: number;
  date: string;
  rede: string;
  formato: string;
  pilar: number;
  objetivo: string;
  com_rosto: boolean;
  tema: string;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  external_url: string | null;
  publish_error: string | null;
  content: PostContent;
  versions: number;
  source: 'ai' | 'demo';
  updated_at: string;
};

export const POST_COLUMNS =
  'id, strategy_id, item_index, date, rede, formato, pilar, objetivo, com_rosto, tema, status, content, versions, source, updated_at, scheduled_at, published_at, external_url, publish_error';

export type PostStatus = 'rascunho' | 'aprovado' | 'agendado' | 'publicando' | 'publicado' | 'erro';
/** Imagem pronta no storage para a publicação automática. */
export type PostAsset = { path: string; w: number; h: number };

/** Redes com publicação automática já disponível (nome usado nos posts → id da conexão). */
export const AUTO_NETWORKS: Record<string, 'linkedin' | 'instagram'> = { LinkedIn: 'linkedin', Instagram: 'instagram' };
export const autoNetworkId = (rede: string) => AUTO_NETWORKS[rede] ?? null;

/** Formatos que dá para publicar sozinho em cada rede. */
export function canAutoPublish(rede: string, formato: string) {
  const k = kindOf(formato);
  if (rede === 'LinkedIn') return k !== 'video' && k !== 'stories';
  if (rede === 'Instagram') return true;
  return false;
}

/** O que ainda falta no post para a rede aceitar (ou null se está tudo certo). */
export function autoBlocker(rede: string, formato: string, c: Pick<PostContent, 'foto' | 'video'>) {
  const k = kindOf(formato);
  if (rede === 'Instagram') {
    if (k === 'video' && !c.video) return 'Escolha o vídeo do reels para agendar no Instagram.';
    if ((k === 'texto' || k === 'thread') && !c.foto) return 'O Instagram não publica só texto. Escolha uma foto para o post.';
  }
  return null;
}

export type FormatKind = 'carrossel' | 'imagem' | 'video' | 'stories' | 'thread' | 'texto' | 'prova';

export function kindOf(formato: string): FormatKind {
  const f = formato.toLowerCase();
  if (f.includes('carrossel')) return 'carrossel';
  if (f.includes('imagem')) return 'imagem';
  if (f.includes('reels') || f.includes('vídeo') || f.includes('video') || f.includes('shorts') || f.includes('tiktok')) return 'video';
  if (f.includes('stories')) return 'stories';
  if (f.includes('thread')) return 'thread';
  if (f.includes('prova')) return 'prova';
  return 'texto';
}


/** Texto final para copiar: legenda + hashtags. */
export function captionWithTags(c: PostContent) {
  const tags = c.hashtags.length ? `\n\n${c.hashtags.map((h) => `#${h}`).join(' ')}` : '';
  return `${c.legenda}${tags}`;
}

/** Número do post na série (#001, #002…), contando a partir do início da série nesta estratégia. */
export function serieNumberFor(calendario: { formato: string }[], index: number, inicio?: number) {
  const n = calendario.slice(0, index + 1).filter((c) => kindOf(c.formato) === 'imagem').length;
  return (inicio ?? 1) - 1 + n;
}
