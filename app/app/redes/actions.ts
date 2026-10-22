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
