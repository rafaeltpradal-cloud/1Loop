'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'avatars';
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function clearOld(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}

// Recebe a foto já recortada e reduzida no navegador (quadrada, até 400 px).
export async function uploadAvatar(formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const file = formData.get('foto');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Escolha uma imagem.' };
  const ext = TYPES[file.type];
  if (!ext) return { ok: false, message: 'Use uma imagem JPG, PNG ou WEBP.' };
  if (file.size > 1024 * 1024) return { ok: false, message: 'A imagem precisa ter até 1 MB.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'Sua sessão expirou. Entre de novo.' };

  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (upErr) {
    console.error('[avatar upload]', upErr);
    return { ok: false, message: 'Não foi possível enviar a foto agora.' };
  }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', user.id);
  if (error) return { ok: false, message: 'Não foi possível salvar a foto agora.' };

  await clearOld(supabase, user.id, path);
  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function removeAvatar(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
  await clearOld(supabase, user.id);
  revalidatePath('/app', 'layout');
  return { ok: true };
}
