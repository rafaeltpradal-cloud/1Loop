'use server';

import { createClient } from '@/lib/supabase/server';

export type PasswordState = { ok?: boolean; error?: string } | undefined;

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get('senha') || '');
  const confirm = String(formData.get('confirmar') || '');
  if (password.length < 8) return { error: 'A nova senha precisa ter pelo menos 8 caracteres.' };
  if (password !== confirm) return { error: 'As duas senhas não são iguais.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/different/i.test(error.message)) return { error: 'A nova senha precisa ser diferente da atual.' };
    return { error: 'Não foi possível trocar a senha agora. Tente de novo.' };
  }
  return { ok: true };
}
