'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentBrandId } from '@/lib/brands';
import { saveManual, syncInstagram } from '@/lib/metrics';

async function who() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Busca agora os números do Instagram da marca em uso (no máximo a cada 10 minutos). */
export async function refreshMetrics(): Promise<{ ok: boolean; message: string }> {
  const user = await who();
  if (!user) return { ok: false, message: 'Sua sessão expirou. Entre de novo.' };
  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const { data: last } = await admin.from('account_metrics').select('updated_at').eq('brand_id', brandId).eq('network', 'instagram').order('updated_at', { ascending: false }).limit(1);
  const lastAt = last?.[0]?.updated_at ? new Date(last[0].updated_at as string).getTime() : 0;
  if (Date.now() - lastAt < 10 * 60 * 1000) return { ok: true, message: 'Os números já estão atualizados.' };
  const r = await syncInstagram(admin, brandId);
  revalidatePath('/app/desempenho');
  if (r.ok) return { ok: true, message: `Atualizado: ${r.posts} ${r.posts === 1 ? 'post' : 'posts'} do Instagram.` };
  if (r.reason === 'sem_conexao') return { ok: false, message: 'Conecte o Instagram em Redes para ver o desempenho.' };
  if (r.reason === 'sem_permissao') return { ok: false, message: 'Reconecte o Instagram em Redes para liberar os números.' };
  return { ok: false, message: 'O Instagram não respondeu agora. Tente de novo em instantes.' };
}

/** Números anotados à mão em um post publicado (LinkedIn e redes sem API). */
export async function saveManualMetrics(postId: number, raw: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const user = await who();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const { data: post } = await admin
    .from('posts')
    .select('id, rede, external_url, published_at, date, tema, status')
    .eq('id', postId)
    .eq('user_id', user.id)
    .eq('brand_id', brandId)
    .maybeSingle();
  if (!post) return { ok: false, error: 'Post não encontrado.' };
  if (post.rede === 'Instagram') return { ok: false, error: 'Os números do Instagram chegam sozinhos.' };
  const ok = await saveManual(admin, user.id, brandId, post as never, raw);
  revalidatePath('/app/desempenho');
  return ok ? { ok: true } : { ok: false, error: 'Não deu para salvar. Tente de novo.' };
}
