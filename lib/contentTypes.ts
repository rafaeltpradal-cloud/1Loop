// Tipos e utilitários dos conteúdos, sem dependências de servidor (usados também no navegador).

export type ImageStyle = 'notas' | 'claro' | 'escuro';
export const IMAGE_STYLES: { id: ImageStyle; nome: string }[] = [
  { id: 'notas', nome: 'Bloco de notas' },
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
];

export type Slide = { titulo: string; texto: string };
export type Scene = { fala: string; visual: string };
export type Story = { tipo: 'texto' | 'enquete' | 'caixinha' | 'link'; texto: string; opcoes?: string[] };

export type PostContent = {
  gancho: string; // primeira frase / título
  legenda: string; // texto pronto para colar na rede
  hashtags: string[];
  cta: string;
  slides?: Slide[]; // carrossel
  imagem?: { frase: string; destaque?: string }; // imagem de série e prova social
  roteiro?: { duracao: string; capa: string; cenas: Scene[] }; // reels / tiktok / shorts
  stories?: Story[];
  partes?: string[]; // thread
  dica?: string; // dica de publicação
  estilo?: ImageStyle;
};

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
  status: 'rascunho' | 'aprovado' | 'publicado';
  content: PostContent;
  versions: number;
  source: 'ai' | 'demo';
  updated_at: string;
};

export const POST_COLUMNS = 'id, strategy_id, item_index, date, rede, formato, pilar, objetivo, com_rosto, tema, status, content, versions, source, updated_at';
export const MAX_VERSIONS = 6; // 1 geração + 5 refações por post

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
