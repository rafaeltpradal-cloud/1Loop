// Mercados: Brasil (padrão) e Portugal (Lisboa, desde nov/26).
// O mercado fica gravado em app_metadata.market no cadastro (a pessoa não consegue mudar).
// Portugal: preço em euro, sem os 7 dias grátis (1 post de teste com tudo liberado; publicou, assina),
// e tudo o que a IA escreve sai em português de Portugal. O Brasil segue exatamente como era.
import type { User } from '@supabase/supabase-js';
import type { PlanId } from '@/lib/plans';

export type Market = 'br' | 'pt';

export const isMarket = (v: unknown): v is Market => v === 'br' || v === 'pt';

/** Mercado da conta (sem marcação = Brasil). */
export function marketOf(user: Pick<User, 'app_metadata'> | null | undefined): Market {
  const m = user?.app_metadata?.market;
  return isMarket(m) ? m : 'br';
}

/** Mercado de quem está se cadastrando: campo do formulário (página de Lisboa); o país do acesso só se for passado. */
export function marketFromSignup(field: string | null | undefined, country: string | null | undefined): Market {
  if (isMarket(field)) return field;
  return (country || '').toUpperCase() === 'PT' ? 'pt' : 'br';
}

/** Preços mensais em euro (Portugal). Sem preço Founders. */
export const EUR_PRICES: Record<PlanId, number> = { basic: 19, pro: 39, multi: 99 };

/** IDs dos preços em euro no Stripe (não são segredo; a variável de ambiente, se existir, tem prioridade). */
const EUR_PRICE_IDS: Record<PlanId, string | undefined> = {
  basic: process.env.STRIPE_PRICE_BASIC_EUR,
  pro: process.env.STRIPE_PRICE_PRO_EUR,
  multi: process.env.STRIPE_PRICE_MULTI_EUR,
};

// Preços em euro criados no Stripe (modo real).
const EUR_PRICE_IDS_FIXED: Record<PlanId, string | undefined> = { basic: undefined, pro: undefined, multi: undefined };

export function eurPriceId(plan: PlanId): string | undefined {
  return EUR_PRICE_IDS[plan] || EUR_PRICE_IDS_FIXED[plan];
}

export function planFromEurPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const id of ['basic', 'pro', 'multi'] as PlanId[]) if (eurPriceId(id) === priceId) return id;
  return null;
}

/** Valor formatado na moeda do mercado: "R$ 197" ou "39 €". */
export function fmtPrice(n: number, market: Market) {
  if (market === 'pt') return `${n.toLocaleString('pt-PT', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })} €`;
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export const currencyOf = (market: Market) => (market === 'pt' ? 'EUR' : 'BRL');

/** Português de Portugal na IA: troca a regra de idioma do prompt (o Brasil não muda nada). */
const PT_RULE =
  'em português europeu (de Portugal), com ortografia, vocabulário e construções de Portugal: "equipa", "utilizador", "telemóvel", "contacto", "facto", "estou a preparar" (nunca o gerúndio brasileiro "estou preparando"), tratamento por "você" ou sem pronome, nada de gírias brasileiras';

export function localize(text: string, market: Market | undefined): string {
  if (market !== 'pt') return text;
  return text
    .replace(/em português do Brasil/g, PT_RULE)
    .replace(/português do Brasil/g, 'português europeu (de Portugal)')
    .replace('uma ferramenta brasileira que cria', 'uma ferramenta que cria')
    .concat(`\nIMPORTANTE: o cliente é de Portugal (mercado de Lisboa). Todo o texto que escrever tem de estar ${PT_RULE}. Referências de mercado, moeda (€) e exemplos devem fazer sentido em Portugal.`);
}

/** Posts no teste de Portugal: 1 post com tudo liberado; depois de publicado, assina. */
export const PT_TEST_POSTS = 1;
