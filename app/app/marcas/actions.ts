'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BRAND_COOKIE, allowedBrands, listBrands } from '@/lib/brands';
import { PLANS, type PlanId } from '@/lib/plans';

export type BrandResult = { ok: true; id?: number } | { ok: false; error: string };

async function setup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const [{ data: subs }, { data: profile }] = await Promise.all([
    admin.from('subscriptions').select('plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    admin.from('profiles').select('name').eq('id', user.id).maybeSingle(),
  ]);
  const p = subs?.[0]?.plan as PlanId | undefined;
  const plan: PlanId = p && p in PLANS ? p : 'pro';
  const brands = await listBrands(admin, user.id, (profile?.name as string | undefined) ?? '');
  return { user, admin, plan, brands };
}

const cleanName = (raw: unknown) => (typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 60) : '');

async function useBrand(id: number) {
  const jar = await cookies();
  jar.set(BRAND_COOKIE, String(id), { path: '/', httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/app', 'layout');
}

/** Troca a marca em uso. */
export async function switchBrand(id: number): Promise<BrandResult> {
  const s = await setup();
  if (!s) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (!allowedBrands(s.brands, s.plan).some((b) => b.id === id)) return { ok: false, error: 'Essa marca não está disponível no seu plano.' };
  await useBrand(id);
  return { ok: true, id };
}

/** Cria uma marca nova (no limite do plano) e já passa a usar ela. */
export async function createBrand(rawName: string): Promise<BrandResult> {
  const s = await setup();
  if (!s) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const name = cleanName(rawName);
  if (name.length < 2) return { ok: false, error: 'Dê um nome para a marca.' };
  const limit = PLANS[s.plan].brands;
  if (s.brands.length >= limit)
    return {
      ok: false,
      error: limit === 1 ? 'Várias marcas são do plano Multi. Faça o upgrade para criar outra.' : `Seu plano permite até ${limit} marcas.`,
    };
  if (s.brands.some((b) => b.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Você já tem uma marca com esse nome.' };
  const { data, error } = await s.admin.from('brands').insert({ user_id: s.user.id, name }).select('id').single();
  if (error || !data) return { ok: false, error: 'Não deu para criar agora. Tente de novo.' };
  await useBrand(data.id as number);
  return { ok: true, id: data.id as number };
}

export async function renameBrand(id: number, rawName: string): Promise<BrandResult> {
  const s = await setup();
  if (!s) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const name = cleanName(rawName);
  if (name.length < 2) return { ok: false, error: 'Dê um nome para a marca.' };
  if (!s.brands.some((b) => b.id === id)) return { ok: false, error: 'Marca não encontrada.' };
  const { error } = await s.admin.from('brands').update({ name, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', s.user.id);
  if (error) return { ok: false, error: 'Não deu para salvar. Tente de novo.' };
  revalidatePath('/app', 'layout');
  return { ok: true, id };
}

/** Apaga a marca e tudo dela (entrevista, estratégias, conteúdos, redes conectadas e biblioteca). */
export async function deleteBrand(id: number, confirmName: string): Promise<BrandResult> {
  const s = await setup();
  if (!s) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const brand = s.brands.find((b) => b.id === id);
  if (!brand) return { ok: false, error: 'Marca não encontrada.' };
  if (s.brands.length <= 1) return { ok: false, error: 'Você precisa ter pelo menos uma marca.' };
  if (cleanName(confirmName).toLowerCase() !== brand.name.toLowerCase()) return { ok: false, error: 'Digite o nome da marca igual para confirmar.' };

  // Arquivos da biblioteca e imagens dos posts desta marca
  const [{ data: media }, { data: posts }] = await Promise.all([
    s.admin.from('media').select('path').eq('brand_id', id).eq('user_id', s.user.id),
    s.admin.from('posts').select('id').eq('brand_id', id).eq('user_id', s.user.id),
  ]);
  const paths = (media ?? []).flatMap((m) => {
    const p = m.path as string;
    return [p, p.replace(/\.[a-z0-9]+$/i, '.thumb.jpg')];
  });
  for (const p of posts ?? []) {
    const { data: files } = await s.admin.storage.from('media').list(`${s.user.id}/posts/${p.id}`);
    for (const f of files ?? []) paths.push(`${s.user.id}/posts/${p.id}/${f.name}`);
  }
  for (let i = 0; i < paths.length; i += 100) await s.admin.storage.from('media').remove(paths.slice(i, i + 100));

  const { error } = await s.admin.from('brands').delete().eq('id', id).eq('user_id', s.user.id);
  if (error) return { ok: false, error: 'Não deu para apagar agora. Tente de novo.' };
  const next = s.brands.find((b) => b.id !== id)!;
  await useBrand(next.id);
  return { ok: true, id: next.id };
}
