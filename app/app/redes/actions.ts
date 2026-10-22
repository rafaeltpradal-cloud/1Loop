'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { cleanHandle, isNetworkId } from '@/lib/networks';

export async function saveHandle(network: string, raw: string): Promise<{ ok: boolean; error?: string }> {
  if (!isNetworkId(network)) return { ok: false, error: 'Rede inválida.' };
  const handle = cleanHandle(raw);
  if (handle.length < 2) return { ok: false, error: 'Informe o @ ou o link do seu perfil.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };

  const { error } = await supabase
    .from('social_accounts')
    .upsert({ user_id: user.id, network, handle, updated_at: new Date().toISOString() }, { onConflict: 'user_id,network' });
  if (error) return { ok: false, error: 'Não foi possível salvar agora. Tente de novo.' };

  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function removeHandle(network: string): Promise<{ ok: boolean }> {
  if (!isNetworkId(network)) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from('social_accounts').delete().eq('user_id', user.id).eq('network', network);
  revalidatePath('/app', 'layout');
  return { ok: !error };
}

/** Desconecta o LinkedIn: apaga o token e cancela os agendamentos pendentes. */
export async function disconnectLinkedIn(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const { getConnection } = await import('@/lib/publish');
  const { revokeToken } = await import('@/lib/linkedin');
  const admin = createAdminClient();
  const conn = await getConnection(admin, user.id, 'linkedin');
  if (conn) {
    try {
      await revokeToken(conn.token());
    } catch {
      // segue mesmo se o LinkedIn não responder
    }
  }
  await admin.from('social_connections').delete().eq('user_id', user.id).eq('network', 'linkedin');
  await admin.from('social_accounts').update({ status: 'pending' }).eq('user_id', user.id).eq('network', 'linkedin');
  await admin
    .from('posts')
    .update({ status: 'aprovado', scheduled_at: null })
    .eq('user_id', user.id)
    .eq('rede', 'LinkedIn')
    .eq('status', 'agendado');
  revalidatePath('/app/redes');
  revalidatePath('/app/conteudos');
  return { ok: true };
}
