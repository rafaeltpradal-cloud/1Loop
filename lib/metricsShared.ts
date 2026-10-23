// Tipos e contas do Desempenho que a tela também usa (sem nada de servidor).

export type Metrics = {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  saved?: number;
  shares?: number;
  interactions?: number;
  impressions?: number;
};

export const METRIC_LABEL: Record<keyof Metrics, string> = {
  views: 'Visualizações',
  impressions: 'Impressões',
  reach: 'Alcance',
  likes: 'Curtidas',
  comments: 'Comentários',
  saved: 'Salvamentos',
  shares: 'Compartilhamentos',
  interactions: 'Interações',
};

/** Interações quando a rede não manda o total pronto. */
export const interactionsOf = (m: Metrics) => m.interactions ?? (m.likes ?? 0) + (m.comments ?? 0) + (m.saved ?? 0) + (m.shares ?? 0);

