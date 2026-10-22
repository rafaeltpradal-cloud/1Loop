'use server';

import { createClient as createPlainClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export type PasswordState = { ok?: boolean; error?: string } | undefined;

// Confere a senha atual sem mexer na sessão do navegador.
async function checkCurrentPassword(email: string, password: string) {
  const probe = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) await probe.auth.signOut({ scope: 'local' });
  return !error;
}

export async function updatePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const current = String(formData.get('atual') || '');
  const password = String(formData.get('senha') || '');
  const confirm = String(formData.get('confirmar') || '');
  if (!current) return { error: 'Digite sua senha atual.' };
  if (password.length < 8) return { error: 'A nova senha precisa ter pelo menos 8 caracteres.' };
  if (password !== confirm) return { error: 'As duas novas senhas não são iguais.' };
  if (password === current) return { error: 'A nova senha precisa ser diferente da atual.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Sua sessão expirou. Entre de novo.' };

  if (!(await checkCurrentPassword(user.email, current))) return { error: 'A senha atual está incorreta.' };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (/different/i.test(error.message)) return { error: 'A nova senha precisa ser diferente da atual.' };
    return { error: 'Não foi possível trocar a senha agora. Tente de novo.' };
  }
  return { ok: true };
}
