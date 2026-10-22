'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { MediaItem } from '@/lib/contentTypes';

const BUCKET = 'media';
const MAX_ITEMS = 150;

export type MediaResult = { ok: true; item?: MediaItem } | { ok: false; error: string };

// Recebe a foto já reduzida no navegador (JPEG até 1920 px) e uma miniatura (até 480 px).
export async function uploadMedia(formData: FormData): Promise<MediaResult> {
  const file = formData.get('foto');
  const thumb = formData.get('thumb');
  const kind = formData.get('kind') === 'referencia' ? 'referencia' : 'foto';
  const width = Number(formData.get('width')) || null;
  const height = Number(formData.get('height')) || null;
  if (!(file instanceof File) || file.size === 0 || !(thumb instanceof File)) return { ok: false, error: 'Escolha uma imagem.' };
  if (file.type !== 'image/jpeg' || thumb.type !== 'image/jpeg') return { ok: false, error: 'Formato de imagem inválido.' };
  if (file.size > 3.5 * 1024 * 1024) return { ok: false, error: 'A imagem ficou grande demais. Tente outra.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };

  const { count } = await supabase.from('media').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if ((count ?? 0) >= MAX_ITEMS) return { ok: false, error: `Você chegou ao limite de ${MAX_ITEMS} imagens. Apague algumas para enviar novas.` };

  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${user.id}/${name}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg', upsert: false });
  if (up.error) {
    console.error('[media upload]', up.error);
    return { ok: false, error: 'Não deu para enviar agora. Tente de novo.' };
  }
  await supabase.storage.from(BUCKET).upload(`${user.id}/${name}.thumb.jpg`, thumb, { contentType: 'image/jpeg', upsert: false });

  const { data, error } = await supabase.from('media').insert({ user_id: user.id, path, kind, width, height }).select('id, kind, width, height').single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path, `${user.id}/${name}.thumb.jpg`]);
    return { ok: false, error: 'Não deu para salvar a imagem.' };
  }
  revalidatePath('/app/conteudos/fotos');
  return { ok: true, item: data as MediaItem };
}

export async function setMediaKind(id: number, kind: 'foto' | 'referencia'): Promise<MediaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (!Number.isInteger(id) || (kind !== 'foto' && kind !== 'referencia')) return { ok: false, error: 'Pedido inválido.' };
  const { error } = await supabase.from('media').update({ kind }).eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: 'Não deu para salvar.' };
  revalidatePath('/app/conteudos/fotos');
  return { ok: true };
}

export async function deleteMedia(id: number): Promise<MediaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const { data: row } = await supabase.from('media').select('path').eq('id', id).eq('user_id', user.id).maybeSingle();
  if (!row) return { ok: false, error: 'Imagem não encontrada.' };
  const path = row.path as string;
  await supabase.storage.from(BUCKET).remove([path, path.replace(/\.jpg$/, '.thumb.jpg')]);
  const { error } = await supabase.from('media').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: 'Não deu para apagar.' };
  revalidatePath('/app/conteudos/fotos');
  return { ok: true };
}
