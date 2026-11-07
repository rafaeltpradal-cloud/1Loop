'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isPlanId } from '@/lib/plans';
import { siteUrl } from '@/lib/stripe';
import { cookies } from 'next/headers';
import { marketFromSignup } from '@/lib/market';
import { createAdminClient } from '@/lib/supabase/admin';
import { ORIGIN_COOKIE, parseOrigin } from '@/lib/tracking';
import { TRIAL_GROUP_COOKIE, cardTestOn, groupFromCookie } from '@/lib/trialGroup';

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
  // Portugal: só quem se cadastra pela página de Lisboa (a promessa da página tem de bater com as regras da conta).
  const market = marketFromSignup(String(formData.get('mercado') || ''), null);
  const pt = market === 'pt';

  if (name.length < 2) return { error: pt ? 'Indique o seu nome.' : 'Informe seu nome.' };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: pt ? 'Indique um e-mail válido.' : 'Informe um e-mail válido.' };
  // WhatsApp é opcional; se vier, precisa ter DDD.
  if (phone && (phone.length < 10 || phone.length > 13)) return { error: 'O WhatsApp precisa ter DDD (ou deixe em branco).' };
  if (password.length < 8) return { error: pt ? 'A palavra-passe precisa de ter pelo menos 8 caracteres.' : 'A senha precisa ter pelo menos 8 caracteres.' };
  if (!accepted) return { error: 'Para continuar, aceite os termos de uso e a política de privacidade.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, plan },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent('/app/entrevista?bemvindo=1')}`,
    },
  });

  if (error) {
    if (/registered|exists/i.test(error.message)) return { error: pt ? 'Este e-mail já tem conta. Entre para continuar.' : 'Este e-mail já tem conta. Entre para continuar.' };
    return { error: pt ? 'Não foi possível criar a sua conta agora. Tente novamente dentro de instantes.' : 'Não foi possível criar sua conta agora. Tente de novo em instantes.' };
  }

  // Mercado e grupo do teste ficam em app_metadata (a pessoa não consegue alterar).
  // Grupo "cartao": a página que a pessoa viu prometia ativar os 7 dias com cartão.
  const group = !pt && cardTestOn() ? groupFromCookie((await cookies()).get(TRIAL_GROUP_COOKIE)?.value) : null;
  if ((pt || group) && data.user) {
    try {
      await createAdminClient().auth.admin.updateUserById(data.user.id, { app_metadata: { ...data.user.app_metadata, ...(pt ? { market: 'pt' } : {}), ...(group ? { trial_group: group } : {}) } });
    } catch (err) {
      console.error('[cadastro mercado/grupo]', err);
    }
  }

  // Guarda de onde a pessoa veio (anúncio, campanha) junto da conta.
  const origin = parseOrigin((await cookies()).get(ORIGIN_COOKIE)?.value);
  if (origin && data.user) {
    try {
      await createAdminClient().from('profiles').update({ origem: origin }).eq('id', data.user.id);
    } catch (err) {
      console.error('[cadastro origem]', err);
    }
  }

  // Se a confirmação de e-mail estiver ligada no Supabase, ainda não há sessão.
  if (!data.session) {
    return { note: pt ? `Enviámos um link de confirmação para ${email}. Abra o e-mail para começar a entrevista.` : `Enviamos um link de confirmação para ${email}. Abra o e-mail para começar a entrevista.` };
  }

  // Sem cartão agora: a pessoa vê a estratégia e os primeiros posts antes de começar o teste.
  redirect('/app/entrevista?bemvindo=1');
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
