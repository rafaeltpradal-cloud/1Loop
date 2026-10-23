'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { autoBlocker, autoNetworkId, canAutoPublish, type PostAsset, type PostContent } from '@/lib/contentTypes';
import { getConnection, publishOne } from '@/lib/publish';

export type PublishResult = { ok: true; url?: string; asset?: PostAsset } | { ok: false; error: string };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Recebe uma imagem do post já desenhada no navegador (JPEG) e guarda na pasta da pessoa. */
export async function uploadPostAsset(postId: number, formData: FormData): Promise<PublishResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const file = formData.get('img');
  const w = Number(formData.get('w'));
  const h = Number(formData.get('h'));
  const n = Number(formData.get('n'));
  if (!Number.isInteger(postId) || !(file instanceof File) || file.type !== 'image/jpeg' || file.size > 3.5 * 1024 * 1024 || !w || !h)
    return { ok: false, error: 'Imagem inválida.' };
  const { data: post } = await supabase.from('posts').select('id').eq('id', postId).eq('user_id', user.id).maybeSingle();
  if (!post) return { ok: false, error: 'Post não encontrado.' };
  const path = `${user.id}/posts/${postId}/${Date.now()}-${Number.isInteger(n) ? n : 0}.jpg`;
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: 'image/jpeg', upsert: true });
  if (error) {
    console.error('[asset upload]', error);
    return { ok: false, error: 'Não deu para preparar as imagens. Tente de novo.' };
  }
  return { ok: true, asset: { path, w, h } };
}

/** Agenda (ou reagenda) a publicação automática. `when` em ISO (UTC). */
export async function schedulePost(postId: number, when: string, assets: PostAsset[]): Promise<PublishResult> {
  const { user } = await currentUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const at = new Date(when);
  if (!Number.isInteger(postId) || Number.isNaN(at.getTime())) return { ok: false, error: 'Data inválida.' };
  if (at.getTime() < Date.now() - 5 * 60 * 1000) return { ok: false, error: 'Escolha um horário no futuro.' };
  const prefix = `${user.id}/posts/${postId}/`;
  const clean = (Array.isArray(assets) ? assets : [])
    .filter((a) => a && typeof a.path === 'string' && a.path.startsWith(prefix) && Number(a.w) > 0 && Number(a.h) > 0)
    .map((a) => ({ path: a.path, w: Math.round(a.w), h: Math.round(a.h) }))
    .slice(0, 12);

  const admin = createAdminClient();
  const { data: post } = await admin.from('posts').select('id, brand_id, rede, formato, status, assets, content').eq('id', postId).eq('user_id', user.id).maybeSingle();
  if (!post) return { ok: false, error: 'Post não encontrado.' };
  if (!canAutoPublish(post.rede, post.formato)) return { ok: false, error: 'Este formato ainda não pode ser publicado sozinho nesta rede.' };
  if (post.status === 'publicado' || post.status === 'publicando') return { ok: false, error: 'Este post já foi publicado.' };

  const blocker = autoBlocker(post.rede, post.formato, (post.content ?? {}) as PostContent);
  if (blocker) return { ok: false, error: blocker };
  const network = autoNetworkId(post.rede)!;
  const conn = await getConnection(admin, post.brand_id as number, network);
  if (!conn) return { ok: false, error: `Conecte o ${post.rede} em Redes para agendar.` };
  // O LinkedIn não renova sozinho; o Instagram renova, então só precisa estar válido agora.
  const limit = network === 'linkedin' ? at.getTime() : Date.now();
  if (new Date(conn.expiresAt).getTime() < limit)
    return { ok: false, error: `A conexão com o ${post.rede} vence antes dessa data. Reconecte em Redes para agendar.` };

  const { error } = await admin
    .from('posts')
    .update({ status: 'agendado', scheduled_at: at.toISOString(), assets: clean, publish_error: null, platform_ref: null, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: 'Não deu para agendar. Tente de novo.' };

  // Apaga as imagens antigas que não vão mais ser usadas.
  const old = ((post.assets as PostAsset[] | null) ?? []).map((a) => a.path).filter((p) => !clean.some((c) => c.path === p));
  if (old.length) await admin.storage.from('media').remove(old);

  revalidatePath('/app/conteudos');
  return { ok: true };
}

export async function cancelSchedule(postId: number): Promise<PublishResult> {
  const { user } = await currentUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('posts')
    .update({ status: 'aprovado', scheduled_at: null, publish_error: null, platform_ref: null, updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', user.id)
    .in('status', ['agendado', 'erro']);
  if (error) return { ok: false, error: 'Não deu para cancelar. Tente de novo.' };
  revalidatePath('/app/conteudos');
  return { ok: true };
}

/** Publica agora (agenda para este instante e publica na hora). */
export async function publishNow(postId: number, assets: PostAsset[]): Promise<PublishResult> {
  const { user } = await currentUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const scheduled = await schedulePost(postId, new Date().toISOString(), assets);
  if (!scheduled.ok) return scheduled;
  const result = await publishOne(createAdminClient(), postId, user.id);
  revalidatePath('/app/conteudos');
  return result.ok ? { ok: true, url: result.url } : { ok: false, error: result.error };
}
