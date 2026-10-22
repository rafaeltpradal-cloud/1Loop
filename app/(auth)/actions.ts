'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isPlanId } from '@/lib/plans';
import { siteUrl } from '@/lib/stripe';

export type FormState = { error?: string; note?: string } | undefined;

const onlyDigits = (s: string) => s.replace(/\D/g, '');

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get('nome') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const phone = onlyDigits(String(formData.get('telefone') || ''));
  const password = String(formData.get('senha') || '');
  const planRaw = String(formData.get('plano') || 'pro');
  const plan = isPlanId(planRaw) ? planRaw : 'pro';
  const accepted = formData.get('termos') === 'on';

  if (name.length < 2) return { error: 'Informe seu nome.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: 'Informe um e-mail válido.' };
  if (phone.length < 10 || phone.length > 13) return { error: 'Informe um telefone com DDD.' };
  if (password.length < 8) return { error: 'A senha precisa ter pelo menos 8 caracteres.' };
  if (!accepted) return { error: 'Para continuar, aceite os termos de uso e a política de privacidade.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, plan },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(`/checkout?plano=${plan}`)}`,
    },
  });

  if (error) {
    if (/registered|exists/i.test(error.message)) return { error: 'Este e-mail já tem conta. Entre para continuar.' };
    return { error: 'Não foi possível criar sua conta agora. Tente de novo em instantes.' };
  }

  // Se a confirmação de e-mail estiver ligada no Supabase, ainda não há sessão.
  if (!data.session) {
    return { note: `Enviamos um link de confirmação para ${email}. Abra o e-mail para continuar para o pagamento.` };
  }

  redirect(`/checkout?plano=${plan}`);
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('senha') || '');
  const next = String(formData.get('next') || '/app');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'E-mail ou senha incorretos.' };

  // Só permite redirecionar para caminhos internos.
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/app');
}
