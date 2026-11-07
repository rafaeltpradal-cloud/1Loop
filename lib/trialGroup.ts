// Teste A/B do teste grátis (Brasil):
// - "livre": 7 dias com tudo liberado, sem cartão (o fluxo de sempre).
// - "cartao": cria a conta e gera os 3 primeiros posts sem cartão; para publicar e liberar o resto,
//   ativa os 7 dias grátis cadastrando o cartão (a cobrança só acontece no 8º dia).
// O grupo é sorteado na primeira visita (cookie) para a página e a conta prometerem a mesma coisa.
import type { User } from '@supabase/supabase-js';

export const TRIAL_GROUP_COOKIE = '1l_tg';
export type TrialGroup = 'livre' | 'cartao';

/** Liga e desliga o teste sem mexer no código (TRIAL_CARD_TEST=0 desliga). */
export const cardTestOn = () => process.env.TRIAL_CARD_TEST !== '0';

export const groupFromCookie = (v: string | undefined | null): TrialGroup | null => (v === 'c' ? 'cartao' : v === 'l' ? 'livre' : null);

export function trialGroupOf(user: Pick<User, 'app_metadata'>): TrialGroup {
  return user.app_metadata?.trial_group === 'cartao' ? 'cartao' : 'livre';
}

/** Dias do teste com cartão (contados a partir de quando a pessoa ativa). */
export const CARD_TRIAL_DAYS = 7;
export const CARD_PENDING_MSG = 'Para publicar e liberar o mês inteiro, ative seus 7 dias grátis. Nada é cobrado hoje.';

