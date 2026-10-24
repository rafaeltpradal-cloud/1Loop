import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { accessFor } from '@/lib/access';
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
  /** Conta nova sem cartão: entrevista, estratégia e até 3 posts (ver lib/access.ts). */
  preview: boolean;
};

// Carrega usuário, perfil e assinatura uma vez por requisição.
// Sem login → /entrar. Assinatura encerrada → /planos. Conta nova sem cartão → prévia.
const loadContext = cache(async (): Promise<AppContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar');

  // Tudo que dá para buscar ao mesmo tempo vai junto (cada ida ao banco custa tempo).
  const admin = createAdminClient();
  const [{ data: profile }, access, { data: brandRows }] = await Promise.all([
    supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle(),
    accessFor(user),
    admin.from('brands').select('id, name, created_at').eq('user_id', user.id).order('created_at').order('id'),
  ]);

  if (access.mode === 'blocked') redirect('/planos?assinatura=pendente');
  const plan: PlanId = access.plan in PLANS ? access.plan : 'pro';
  const sub = { status: access.status, trial_end: access.trialEnd };

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
    preview: access.mode === 'preview',
  };
});

/** Páginas que a prévia mostra: início, entrevista, estratégia e conteúdos. */
export async function getPreviewContext(): Promise<AppContext> {
  return loadContext();
}

/** Demais páginas: na prévia, levam para a tela de começar o teste. */
export async function getAppContext(): Promise<AppContext> {
  const ctx = await loadContext();
  if (ctx.preview) redirect('/app/assinar');
  return ctx;
}
