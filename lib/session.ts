import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { PLANS, type PlanId } from '@/lib/plans';
import { createAdminClient } from '@/lib/supabase/admin';
import { listBrands, pickBrand, type BrandRow } from '@/lib/brands';

export type AppContext = {
  userId: string;
  email: string;
  name: string;
  firstName: string;
  plan: PlanId;
  status: string;
  trialDaysLeft: number | null;
  hasStrategy: boolean;
  avatarUrl: string | null;
  /** Marca em uso: tudo do app (entrevista, estratégia, conteúdos, redes, biblioteca) é dela. */
  brandId: number;
  brandName: string;
  /** Todas as marcas; as que passam do limite do plano ficam bloqueadas. */
  brands: { id: number; name: string; locked: boolean }[];
  brandLimit: number;
};

// Carrega usuário, perfil e assinatura uma vez por requisição.
// Sem login → /entrar. Sem assinatura ativa ou em teste → /planos.
export const getAppContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  // Tudo que dá para buscar ao mesmo tempo vai junto (cada ida ao banco custa tempo).
  const admin = createAdminClient();
  const [{ data: profile }, { data: subs }, { data: brandRows }] = await Promise.all([
    supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('subscriptions').select('plan, status, trial_end').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    admin.from('brands').select('id, name, created_at').eq('user_id', user.id).order('created_at').order('id'),
  ]);

  const sub = subs?.[0];
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) redirect('/planos?assinatura=pendente');
  const plan: PlanId = (sub.plan as PlanId) in PLANS ? (sub.plan as PlanId) : 'pro';

  const brands = brandRows?.length ? (brandRows as BrandRow[]) : await listBrands(admin, user.id, (profile?.name as string | undefined) || '');
  const brand = await pickBrand(brands, plan);
  const limit = PLANS[plan].brands;
  const { count } = await supabase.from('strategies').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('brand_id', brand.id);

  const trialDaysLeft =
    sub.status === 'trialing' && sub.trial_end ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000)) : null;
  const name = (profile?.name as string | undefined) || user.email?.split('@')[0] || '';

  return {
    userId: user.id,
    email: user.email ?? '',
    name,
    firstName: name.split(' ')[0],
    plan,
    status: sub.status,
    trialDaysLeft,
    hasStrategy: (count ?? 0) > 0,
    avatarUrl: (profile?.avatar_url as string | null | undefined) ?? null,
    brandId: brand.id,
    brandName: brand.name,
    brands: brands.map((b, i) => ({ id: b.id, name: b.name, locked: i >= limit })),
    brandLimit: limit,
  };
});
