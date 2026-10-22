'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { onlyDigits } from '@/lib/phone';

export type ProfileState = { ok?: boolean; error?: string } | undefined;

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const name = String(formData.get('nome') || '').trim();
  const phone = onlyDigits(String(formData.get('telefone') || ''));
  if (name.length < 2) return { error: 'Informe seu nome.' };
  if (phone.length < 10 || phone.length > 13) return { error: 'Informe um telefone com DDD.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sua sessão expirou. Entre de novo.' };

  const { error } = await supabase.from('profiles').update({ name: name.slice(0, 120), phone }).eq('id', user.id);
  if (error) return { error: 'Não foi possível salvar agora. Tente de novo.' };

  revalidatePath('/app', 'layout');
  return { ok: true };
}
