'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentBrandId } from '@/lib/brands';
import { accessFor } from '@/lib/access';
import { addContext, deleteContext, type ContextItem } from '@/lib/userContext';
import { createMcpToken, revokeMcpTokens } from '@/lib/mcp';
import { siteUrl } from '@/lib/stripe';

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function saveContext(input: { tipo: string; titulo: string; texto: string }): Promise<{ ok: true; item: ContextItem } | { ok: false; error: string }> {
  const user = await me();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  const admin = createAdminClient();
  const r = await addContext(admin, user.id, await currentBrandId(user.id, admin), input, 'app');
  if ('error' in r) return { ok: false, error: r.error ?? 'Não deu para salvar.' };
  revalidatePath('/app/contexto');
  return { ok: true, item: r.item };
}

export async function removeContext(id: number): Promise<{ ok: boolean }> {
  const user = await me();
  if (!user || !Number.isInteger(id)) return { ok: false };
  const ok = await deleteContext(createAdminClient(), user.id, id);
  revalidatePath('/app/contexto');
  return { ok };
}

/** Gera o link de conexão MCP (mostrado uma vez). Revoga o anterior da marca. */
export async function newMcpLink(): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await me();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if ((await accessFor(user)).mode === 'blocked') return { ok: false, error: 'Sua assinatura não está ativa.' };
  const admin = createAdminClient();
  try {
    const token = await createMcpToken(admin, user.id, await currentBrandId(user.id, admin));
    revalidatePath('/app/contexto');
    return { ok: true, url: `${siteUrl()}/api/mcp/${token}` };
  } catch {
    return { ok: false, error: 'Não deu para gerar o link agora.' };
  }
}

export async function revokeMcpLink(): Promise<{ ok: boolean }> {
  const user = await me();
  if (!user) return { ok: false };
  const admin = createAdminClient();
  await revokeMcpTokens(admin, user.id, await currentBrandId(user.id, admin));
  revalidatePath('/app/contexto');
  return { ok: true };
}
