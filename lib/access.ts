// Acesso ao app:
// - A partir de 16/11/2026 (PAID_MODEL_LAUNCH): sem teste grátis. A conta nova vê a estratégia e os primeiros
//   posts de graça (PRÉVIA); para publicar no automático e gerar o resto, assina e paga na hora
//   (garantia de 7 dias: devolvemos 100% se pedir nesse prazo).
// - Contas de 05 a 16/11: 7 dias de teste grátis sem cartão, contados do cadastro.
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

/** Fim do teste grátis: a partir daqui a conta nova paga na hora (com garantia de 7 dias). */
export const PAID_MODEL_LAUNCH = Date.parse('2026-11-16T12:00:00-03:00');
/** Dias da garantia (devolução integral se pedir nesse prazo). */
export const GUARANTEE_DAYS = 7;

/** Fim do teste grátis sem cartão desta conta (contas do modelo novo: já começa encerrado). */
export function freeTrialEnd(user: Pick<User, 'created_at'>): Date {
  const created = Date.parse(user.created_at);
  if (created >= PAID_MODEL_LAUNCH) return new Date(created);
  return new Date(Math.max(created, FREE_TRIAL_LAUNCH) + FREE_TRIAL_DAYS * DAY);
}

/** Teste grátis sem cartão ainda valendo? (falso para todas as contas do modelo novo) */
export const inFreeTrial = (user: Pick<User, 'created_at'>, now = Date.now()) => freeTrialEnd(user).getTime() > now;

/** Dono da 1loop (mesma lista do painel): acesso total sempre, para usar o produto no próprio perfil. */
const isOwnerEmail = (email?: string | null) =>
  !!email &&
  (process.env.OWNER_EMAILS || 'rafaeltpradal@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());

export type Access = (
  | { mode: 'paid'; plan: PlanId; status: string; trialEnd: string | null }
  | { mode: 'preview'; plan: PlanId; status: 'preview' | 'card_pending'; trialEnd: null }
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
export async function accessFor(user: Pick<User, 'id' | 'user_metadata' | 'created_at' | 'app_metadata'> & { email?: string | null }): Promise<Access> {
  const market = marketOf(user);
  if (isOwnerEmail(user.email)) return { mode: 'paid', plan: 'multi', status: 'owner', trialEnd: null, market };
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
  // Segurança: "em teste" com o teste vencido há mais de 2 dias quer dizer que a Stripe não avisou a mudança
  // (cobrança, falha ou cancelamento). Não libera uso grátis indefinido; a pessoa vê os planos.
  const staleTrial = sub.status === 'trialing' && !!sub.trial_end && Date.parse(sub.trial_end as string) < Date.now() - 2 * DAY;
  if (staleTrial) return { mode: 'blocked', plan, status: 'trial_expired', trialEnd: sub.trial_end as string, market };
  const mode = ACTIVE_STATUSES.includes(sub.status) ? 'paid' : 'blocked';
  return { mode, plan, status: sub.status as string, trialEnd: (sub.trial_end as string | null) ?? null, market };
}

export const PREVIEW_LOCKED_MSG = 'Para continuar ajustando com a IA, assine. Garantia de 7 dias: se não gostar, devolvemos 100%.';

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
