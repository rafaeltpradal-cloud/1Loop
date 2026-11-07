// Acesso ao app:
// - Conta nova: 7 dias de TESTE GRÁTIS SEM CARTÃO com tudo liberado (publicar, conectar redes, IA).
//   Contas criadas antes do lançamento ganham os 7 dias a partir do lançamento.
// - Assinantes (teste do Stripe ou pago) usam tudo.
// - Acabou o teste grátis sem assinar: PRÉVIA (vê e edita o que já tem; para gerar e publicar, assina).
import type { User } from '@supabase/supabase-js';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { isPlanId, type PlanId } from '@/lib/plans';
import { createAdminClient } from '@/lib/supabase/admin';
import { marketOf, PT_TEST_POSTS, type Market } from '@/lib/market';
import { CARD_PENDING_MSG, trialGroupOf } from '@/lib/trialGroup';

// 2 estratégias: a do começo rápido e a refeita depois da entrevista completa.
export const PREVIEW = { strategies: 2, posts: 3 };

const DAY = 86400000;
export const FREE_TRIAL_DAYS = 7;
/** Início do teste grátis sem cartão (antes disso o teste de 7 dias pedia cartão). */
export const FREE_TRIAL_LAUNCH = Date.parse('2026-11-05T00:00:00-03:00');

/** Fim do teste grátis sem cartão desta conta. */
export function freeTrialEnd(user: Pick<User, 'created_at'>): Date {
  return new Date(Math.max(Date.parse(user.created_at), FREE_TRIAL_LAUNCH) + FREE_TRIAL_DAYS * DAY);
}

export type Access = (
  | { mode: 'paid'; plan: PlanId; status: string; trialEnd: string | null }
  | { mode: 'preview'; plan: PlanId; status: 'preview'; trialEnd: null }
  | { mode: 'blocked'; plan: PlanId; status: string; trialEnd: string | null }
) & { market: Market };

/** Quantos posts novos a conta pode gerar sem assinar (Brasil: prévia de 3; Portugal: o post de teste). */
export const previewPostLimit = (market: Market) => (market === 'pt' ? PT_TEST_POSTS : PREVIEW.posts);

/** Plano escolhido no cadastro (fica nos dados da conta). */
export function chosenPlan(user: Pick<User, 'user_metadata'>): PlanId {
  const p = user.user_metadata?.plan;
  return isPlanId(p) ? p : 'pro';
}

/** Prévia só para quem nunca teve assinatura. Quem cancelou ou teve o teste encerrado volta para os planos. */
export async function accessFor(user: Pick<User, 'id' | 'user_metadata' | 'created_at' | 'app_metadata'>): Promise<Access> {
  const market = marketOf(user);
  const { data } = await createAdminClient()
    .from('subscriptions')
    .select('plan, status, trial_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const sub = data?.[0];
  if (!sub) {
    // Portugal: sem os 7 dias. Tudo liberado (inclusive conectar o LinkedIn e publicar) até o post de teste ir ao ar.
    if (market === 'pt') {
      const { count } = await createAdminClient().from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'publicado');
      if (!count) return { mode: 'paid', plan: chosenPlan(user), status: 'trial_post', trialEnd: null, market };
      return { mode: 'preview', plan: chosenPlan(user), status: 'preview', trialEnd: null, market };
    }
    // Grupo "cartao" do teste A/B: prévia (3 posts) até ativar os 7 dias com cartão.
    if (trialGroupOf(user) === 'cartao') return { mode: 'preview', plan: chosenPlan(user), status: 'card_pending', trialEnd: null, market };
    // Teste grátis sem cartão: status próprio ('trial_free') para a interface e os e-mails saberem.
    const end = freeTrialEnd(user);
    if (end.getTime() > Date.now()) return { mode: 'paid', plan: chosenPlan(user), status: 'trial_free', trialEnd: end.toISOString(), market };
    return { mode: 'preview', plan: chosenPlan(user), status: 'preview', trialEnd: null, market };
  }
  const plan: PlanId = isPlanId(sub.plan) ? sub.plan : 'pro';
  const mode = ACTIVE_STATUSES.includes(sub.status) ? 'paid' : 'blocked';
  return { mode, plan, status: sub.status as string, trialEnd: (sub.trial_end as string | null) ?? null, market };
}

export const PREVIEW_LOCKED_MSG = 'Seu teste grátis acabou. Assine para voltar a ajustar com a IA.';

/** Portugal: o teste é um post. Publicou, assina (a mensagem do Brasil segue igual). */
export const PT_LOCKED_MSG = 'O seu post de teste já foi publicado. Assine para continuar.';
/** Mensagem de bloqueio: Portugal, grupo do cartão (ainda não ativou o teste) ou a do Brasil. */
export const lockedMsg = (a: Market | Pick<Access, 'market' | 'status'>, br: string) => {
  const market = typeof a === 'string' ? a : a.market;
  if (market === 'pt') return PT_LOCKED_MSG;
  if (typeof a !== 'string' && a.status === 'card_pending') return CARD_PENDING_MSG;
  return br;
};
export const PT_TEST_USED_MSG = 'O seu post de teste já está criado. Publique-o no LinkedIn e assine para gerar os próximos.';

/** Quantos posts e estratégias a conta já gerou (a prévia conta tudo, de todas as marcas). */
export async function previewUsage(userId: string) {
  const admin = createAdminClient();
  const [st, po] = await Promise.all([
    admin.from('strategies').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return { strategies: st.count ?? 0, posts: po.count ?? 0 };
}
