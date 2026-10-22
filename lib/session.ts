import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { PLANS, type PlanId } from '@/lib/plans';

export type AppContext = {
  userId: string;
  email: string;
  name: string;
  firstName: string;
  plan: PlanId;
  status: string;
  trialDaysLeft: number | null;
  hasStrategy: boolean;
};

// Carrega usuário, perfil e assinatura uma vez por requisição.
// Sem login → /entrar. Sem assinatura ativa ou em teste → /planos.
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  const [{ data: profile }, { data: subs }, { count }] = await Promise.all([
    supabase.from('profiles').select('name').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('plan, status, trial_end').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('strategies').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const sub = subs?.[0];
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) redirect('/planos?assinatura=pendente');

  const trialDaysLeft =
    sub.status === 'trialing' && sub.trial_end ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000)) : null;
  const name = (profile?.name as string | undefined) || user.email?.split('@')[0] || '';

  return {
    userId: user.id,
    email: user.email ?? '',
    name,
    firstName: name.split(' ')[0],
    plan: (sub.plan as PlanId) in PLANS ? (sub.plan as PlanId) : 'pro',
    status: sub.status,
    trialDaysLeft,
    hasStrategy: (count ?? 0) > 0,
  };
});
