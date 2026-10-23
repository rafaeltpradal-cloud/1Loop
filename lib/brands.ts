// Marcas: no plano Multi a pessoa tem várias, cada uma com entrevista, estratégia, conteúdos, redes e biblioteca próprias.
// A marca em uso fica num cookie. Basic e Pro usam só a primeira marca.

import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS, type PlanId } from '@/lib/plans';

export const BRAND_COOKIE = 'brand';
export type BrandRow = { id: number; name: string; created_at: string };

type Admin = ReturnType<typeof createAdminClient>;

/** Marcas da pessoa (cria a primeira se não tiver nenhuma). */
export async function listBrands(admin: Admin, userId: string, fallbackName: string): Promise<BrandRow[]> {
  const { data } = await admin.from('brands').select('id, name, created_at').eq('user_id', userId).order('created_at').order('id');
  if (data?.length) return data as BrandRow[];
  const { data: created } = await admin
    .from('brands')
    .insert({ user_id: userId, name: (fallbackName || 'Minha marca').slice(0, 60) })
    .select('id, name, created_at')
    .single();
  return created ? [created as BrandRow] : [];
}

/** Só as primeiras marcas que cabem no plano ficam liberadas. */
export const allowedBrands = (brands: BrandRow[], plan: PlanId) => brands.slice(0, Math.max(1, PLANS[plan]?.brands ?? 1));

export async function pickBrand(brands: BrandRow[], plan: PlanId) {
  const allowed = allowedBrands(brands, plan);
  const jar = await cookies();
  const wanted = Number(jar.get(BRAND_COOKIE)?.value);
  return allowed.find((b) => b.id === wanted) ?? allowed[0];
}

async function currentPlan(admin: Admin, userId: string): Promise<PlanId> {
  const { data } = await admin.from('subscriptions').select('plan').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
  const p = data?.[0]?.plan as PlanId | undefined;
  return p && p in PLANS ? p : 'pro';
}

/** Marca em uso, para rotas e ações que não passam pelo contexto do app. */
export async function currentBrandId(userId: string, admin: Admin = createAdminClient()): Promise<number> {
  const [brands, plan] = await Promise.all([listBrands(admin, userId, ''), currentPlan(admin, userId)]);
  const b = await pickBrand(brands, plan);
  if (!b) throw new Error('Sem marca');
  return b.id;
}
