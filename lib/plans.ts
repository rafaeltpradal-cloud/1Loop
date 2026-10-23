export type PlanId = 'basic' | 'pro' | 'multi';

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  priceFull: number; // R$/mês
  priceFounders?: number; // R$/mês no preço Founders
  rhythm: string;
  postsPerMonth: number;
  brands: number;
  everyNDays: number; // 1 = todo dia, 3 = a cada 3 dias
  canvas: boolean; // editor visual das imagens
  // Limites de uso da IA (no Multi, por marca). Renovam todo mês.
  strategiesPerMonth: number; // estratégias novas por mês
  refacoes: number; // vezes que dá para refazer cada post
  postAdjusts: number; // pedidos de ajuste à IA por post
  strategyAdjusts: number; // pedidos de ajuste à IA por estratégia
  features: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  basic: {
    id: 'basic',
    name: 'Basic',
    tagline: 'Para manter presença com constância',
    priceFull: 97,
    priceFounders: 67,
    rhythm: '1 conteúdo a cada 3 dias',
    postsPerMonth: 10,
    brands: 1,
    everyNDays: 3,
    canvas: false,
    strategiesPerMonth: 2,
    refacoes: 3,
    postAdjusts: 10,
    strategyAdjusts: 10,
    features: ['Entrevista e perfil de voz', 'Painel de estratégia de 30 dias (2 versões por mês)', 'Com ou sem rosto, todos os formatos', 'Suas fotos e referências nos posts', 'Publicação automática'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Para crescer rápido e virar referência',
    priceFull: 197,
    priceFounders: 147,
    rhythm: 'Conteúdo todos os dias',
    postsPerMonth: 30,
    brands: 1,
    everyNDays: 1,
    canvas: true,
    strategiesPerMonth: 3,
    refacoes: 5,
    postAdjusts: 15,
    strategyAdjusts: 10,
    features: ['Tudo do Basic, com 3 versões de estratégia por mês', 'Editor visual das imagens (canvas)', 'Plano de engajamento', 'Revisão mensal da estratégia'],
  },
  multi: {
    id: 'multi',
    name: 'Multi',
    tagline: 'Para agências, times e várias marcas',
    priceFull: 497,
    rhythm: 'Todo dia, até 6 marcas',
    postsPerMonth: 30,
    brands: 6,
    everyNDays: 1,
    canvas: true,
    strategiesPerMonth: 3,
    refacoes: 5,
    postAdjusts: 15,
    strategyAdjusts: 10,
    features: ['Tudo do Pro em cada marca', 'Editor visual em todas as marcas', 'Até 6 marcas e time', 'Aprovação pelo cliente e relatórios'],
  },
};

/** Gerações de um post: a primeira + as refações. */
export const maxVersions = (plan: PlanId) => 1 + PLANS[plan].refacoes;

export const PLAN_ORDER: PlanId[] = ['basic', 'pro', 'multi'];

// Pacote avulso: poucos posts extras, pagamento único.
export const EXTRA_PACK = { posts: 5, price: 39 };

export function isPlanId(v: unknown): v is PlanId {
  return v === 'basic' || v === 'pro' || v === 'multi';
}

export function stripePriceId(plan: PlanId): string | undefined {
  const map: Record<PlanId, string | undefined> = {
    basic: process.env.STRIPE_PRICE_BASIC,
    pro: process.env.STRIPE_PRICE_PRO,
    multi: process.env.STRIPE_PRICE_MULTI,
  };
  return map[plan];
}

export function foundersCoupon(plan: PlanId): string | undefined {
  if (plan === 'basic') return process.env.STRIPE_COUPON_FOUNDERS_BASIC || undefined;
  if (plan === 'pro') return process.env.STRIPE_COUPON_FOUNDERS_PRO || undefined;
  return undefined;
}

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_BASIC) return 'basic';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_MULTI) return 'multi';
  return null;
}

export const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR')}`;
