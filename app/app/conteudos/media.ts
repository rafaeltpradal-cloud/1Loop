'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { MediaItem } from '@/lib/contentTypes';
import { currentBrandId } from '@/lib/brands';

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

  const { data, error } = await supabase.from('media').insert({ user_id: user.id, brand_id: await currentBrandId(user.id), path, kind, width, height }).select('id, kind, width, height').single();
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
  await supabase.storage.from(BUCKET).remove([path, path.replace(/\.[a-z0-9]+$/i, '.thumb.jpg')]);
  const { error } = await supabase.from('media').delete().eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: 'Não deu para apagar.' };
  revalidatePath('/app/conteudos/fotos');
  return { ok: true };
}

const MAX_VIDEOS = 30;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Registra um vídeo que o navegador já enviou direto para a pasta da pessoa. */
export async function registerVideo(input: { path: string; mime: string; size: number; width: number; height: number; duration: number }): Promise<MediaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const { path, mime, size, width, height, duration } = input ?? ({} as typeof input);
  if (typeof path !== 'string' || !new RegExp(`^${user.id}/v-[a-z0-9-]+\\.(mp4|mov)$`).test(path)) return { ok: false, error: 'Vídeo inválido.' };
  if (mime !== 'video/mp4' && mime !== 'video/quicktime') return { ok: false, error: 'Use vídeo MP4 ou MOV.' };
  if (!(size > 0 && size <= MAX_VIDEO_BYTES)) return { ok: false, error: 'O vídeo pode ter até 50 MB.' };
  const { count } = await supabase.from('media').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('kind', 'video');
  if ((count ?? 0) >= MAX_VIDEOS) return { ok: false, error: `Você chegou ao limite de ${MAX_VIDEOS} vídeos. Apague alguns para enviar novos.` };

  const { data, error } = await supabase
    .from('media')
    .insert({ user_id: user.id, brand_id: await currentBrandId(user.id), path, kind: 'video', mime, size_bytes: Math.round(size), width: Math.round(width) || null, height: Math.round(height) || null, duration_s: Number(duration) || null })
    .select('id, kind, width, height, duration_s')
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path, path.replace(/\.[a-z0-9]+$/i, '.thumb.jpg')]);
    return { ok: false, error: 'Não deu para salvar o vídeo.' };
  }
  revalidatePath('/app/conteudos/fotos');
  return { ok: true, item: data as MediaItem };
}
