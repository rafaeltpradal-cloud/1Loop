// Uso da IA no mês (horário de Brasília). No Multi, as cotas valem por marca; os posts extras de pacote são da conta.

import { createAdminClient } from '@/lib/supabase/admin';
import { isoInBrazil } from '@/lib/dates';
import { PLANS, type PlanId } from '@/lib/plans';

type Admin = ReturnType<typeof createAdminClient>;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Começo do mês atual e do próximo, em Brasília. */
export function monthWindow(now = new Date()) {
  const [y, m] = isoInBrazil(now).split('-').map(Number);
  const start = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const next = new Date(`${ny}-${String(nm).padStart(2, '0')}-01T00:00:00-03:00`);
  return { start: start.toISOString(), next: next.toISOString(), month: MESES[m - 1], nextMonth: MESES[nm - 1] };
}

export type Usage = {
  month: string;
  nextMonth: string;
  strategies: { used: number; max: number };
  posts: { used: number; max: number };
  extras: { total: number; used: number; available: number };
};

export async function getUsage(admin: Admin, userId: string, brandId: number, plan: PlanId): Promise<Usage> {
  const w = monthWindow();
  const [st, po, packs, ex] = await Promise.all([
    admin.from('strategies').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).gte('created_at', w.start),
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('brand_id', brandId).eq('extra', false).gte('created_at', w.start),
    admin.from('extra_packs').select('posts').eq('user_id', userId),
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('extra', true),
  ]);
  const total = (packs.data ?? []).reduce((s: number, p: { posts: number | null }) => s + (p.posts ?? 0), 0);
  const used = ex.count ?? 0;
  return {
    month: w.month,
    nextMonth: w.nextMonth,
    strategies: { used: st.count ?? 0, max: PLANS[plan].strategiesPerMonth },
    posts: { used: po.count ?? 0, max: PLANS[plan].postsPerMonth },
    extras: { total, used, available: Math.max(0, total - used) },
  };
}

export async function planOf(admin: Admin, userId: string): Promise<{ plan: PlanId; status: string | null }> {
  const { data } = await admin.from('subscriptions').select('plan, status').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
  const p = data?.[0]?.plan as PlanId | undefined;
  return { plan: p && p in PLANS ? p : 'pro', status: (data?.[0]?.status as string | undefined) ?? null };
}
