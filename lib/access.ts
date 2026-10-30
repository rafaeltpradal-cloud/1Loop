// Acesso ao app: assinantes (teste ou pago) usam tudo; quem acabou de criar a conta e
// ainda não colocou o cartão entra na PRÉVIA: entrevista, 1 estratégia e até 3 posts,
// para ver o resultado antes de começar os 7 dias de teste.
import type { User } from '@supabase/supabase-js';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { isPlanId, type PlanId } from '@/lib/plans';
import { createAdminClient } from '@/lib/supabase/admin';

// 2 estratégias: a do começo rápido e a refeita depois da entrevista completa.
export const PREVIEW = { strategies: 2, posts: 3 };

export type Access =
  | { mode: 'paid'; plan: PlanId; status: string; trialEnd: string | null }
  | { mode: 'preview'; plan: PlanId; status: 'preview'; trialEnd: null }
  | { mode: 'blocked'; plan: PlanId; status: string; trialEnd: string | null };

/** Plano escolhido no cadastro (fica nos dados da conta). */
export function chosenPlan(user: Pick<User, 'user_metadata'>): PlanId {
  const p = user.user_metadata?.plan;
  return isPlanId(p) ? p : 'pro';
}

/** Prévia só para quem nunca teve assinatura. Quem cancelou ou teve o teste encerrado volta para os planos. */
export async function accessFor(user: Pick<User, 'id' | 'user_metadata'>): Promise<Access> {
  const { data } = await createAdminClient()
    .from('subscriptions')
    .select('plan, status, trial_end')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  const sub = data?.[0];
  if (!sub) return { mode: 'preview', plan: chosenPlan(user), status: 'preview', trialEnd: null };
  const plan: PlanId = isPlanId(sub.plan) ? sub.plan : 'pro';
  const mode = ACTIVE_STATUSES.includes(sub.status) ? 'paid' : 'blocked';
  return { mode, plan, status: sub.status as string, trialEnd: (sub.trial_end as string | null) ?? null };
}

export const PREVIEW_LOCKED_MSG = 'Ajustar com a IA faz parte do teste. Comece seus 7 dias grátis para liberar.';

/** Quantos posts e estratégias a conta já gerou (a prévia conta tudo, de todas as marcas). */
export async function previewUsage(userId: string) {
  const admin = createAdminClient();
  const [st, po] = await Promise.all([
    admin.from('strategies').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);
  return { strategies: st.count ?? 0, posts: po.count ?? 0 };
}
