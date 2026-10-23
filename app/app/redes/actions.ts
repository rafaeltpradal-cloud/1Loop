'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { cleanHandle, isNetworkId } from '@/lib/networks';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentBrandId } from '@/lib/brands';
import { sendEmail } from '@/lib/email';

export async function saveHandle(network: string, raw: string): Promise<{ ok: boolean; error?: string }> {
  if (!isNetworkId(network)) return { ok: false, error: 'Rede inválida.' };
  const handle = cleanHandle(raw);
  if (handle.length < 2) return { ok: false, error: 'Informe o @ ou o link do seu perfil.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const { error } = await admin
    .from('social_accounts')
    .upsert({ user_id: user.id, brand_id: brandId, network, handle, updated_at: new Date().toISOString() }, { onConflict: 'brand_id,network' });
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
  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const { error } = await admin.from('social_accounts').delete().eq('user_id', user.id).eq('brand_id', brandId).eq('network', network);
  revalidatePath('/app', 'layout');
  return { ok: !error };
}

/** Desconecta uma rede: apaga o token e cancela os agendamentos pendentes dela. */
export async function disconnectNetwork(network: 'linkedin' | 'instagram'): Promise<{ ok: boolean; error?: string }> {
  if (network !== 'linkedin' && network !== 'instagram') return { ok: false, error: 'Rede inválida.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const { getConnection } = await import('@/lib/publish');
  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  if (network === 'linkedin') {
    const { revokeToken } = await import('@/lib/linkedin');
    const conn = await getConnection(admin, brandId, 'linkedin');
    if (conn) {
      try {
        await revokeToken(conn.token());
      } catch {
        // segue mesmo se o LinkedIn não responder
      }
    }
  }
  const rede = network === 'linkedin' ? 'LinkedIn' : 'Instagram';
  // Só a conexão desta marca; a mesma conta pode continuar ligada em outra marca.
  await admin.from('social_connections').delete().eq('brand_id', brandId).eq('network', network);
  await admin.from('social_accounts').update({ status: 'pending' }).eq('brand_id', brandId).eq('network', network);
  await admin.from('posts').update({ status: 'aprovado', scheduled_at: null, platform_ref: null }).eq('brand_id', brandId).eq('rede', rede).eq('status', 'agendado');
  revalidatePath('/app/redes');
  revalidatePath('/app/conteudos');
  return { ok: true };
}

/** Pede convite para conectar o Instagram enquanto o app está em análise na Meta. */
export async function requestInstagramInvite(raw: string): Promise<{ ok: boolean; error?: string }> {
  const handle = cleanHandle(raw);
  if (handle.length < 2) return { ok: false, error: 'Informe o @ do seu Instagram.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  await admin
    .from('social_accounts')
    .upsert({ user_id: user.id, brand_id: brandId, network: 'instagram', handle, updated_at: new Date().toISOString() }, { onConflict: 'brand_id,network' });

  const sent = await sendEmail({
    to: process.env.INVITE_INBOX || 'contato@1loopcreators.com.br',
    subject: `Convite Instagram: @${handle}`,
    text: `Pedido de convite para conectar o Instagram.\n\nInstagram: @${handle}\nConta 1loop: ${user.email}\n\nAdicione em developers.facebook.com > app 1Loop Creators > Funções do app > Testadores do Instagram.`,
    html: `<p>Pedido de convite para conectar o Instagram.</p><p><b>Instagram:</b> @${handle}<br><b>Conta 1loop:</b> ${user.email}</p><p>Adicione em developers.facebook.com → app 1Loop Creators → Funções do app → Testadores do Instagram.</p>`,
  });
  if (!sent) return { ok: false, error: 'Não conseguimos enviar o pedido agora. Tente de novo em instantes.' };
  revalidatePath('/app/redes');
  return { ok: true };
}
