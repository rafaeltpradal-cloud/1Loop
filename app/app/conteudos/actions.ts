'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sanitizeEdit, type PostContent } from '@/lib/content';
import { PLANS, type PlanId } from '@/lib/plans';

export type ActionResult = { ok: true } | { ok: false; error: string };

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Salva o que a pessoa editou no post (texto, slides, roteiro, estilo da imagem). */
export async function savePost(id: number, edit: unknown): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (!Number.isInteger(id)) return { ok: false, error: 'Post inválido.' };
  const admin = createAdminClient();
  const [{ data: row }, { data: subs }, { data: media }] = await Promise.all([
    admin.from('posts').select('content').eq('id', id).eq('user_id', user.id).maybeSingle(),
    admin.from('subscriptions').select('plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    admin.from('media').select('id').eq('user_id', user.id),
  ]);
  if (!row) return { ok: false, error: 'Post não encontrado.' };
  const plan = subs?.[0]?.plan as PlanId | undefined;
  const content = sanitizeEdit(edit, row.content as PostContent, {
    allowCanvas: !!plan && PLANS[plan]?.canvas === true,
    mediaIds: new Set((media ?? []).map((m) => m.id as number)),
  });
  const { error } = await admin.from('posts').update({ content, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: 'Não deu para salvar. Tente de novo.' };
  revalidatePath('/app/conteudos');
  return { ok: true };
}

/** Rascunho → aprovado → publicado (e volta, se precisar). */
export async function setPostStatus(id: number, status: 'rascunho' | 'aprovado' | 'publicado'): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (!Number.isInteger(id) || !['rascunho', 'aprovado', 'publicado'].includes(status)) return { ok: false, error: 'Pedido inválido.' };
  const admin = createAdminClient();
  const { error } = await admin.from('posts').update({ status, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id);
  if (error) return { ok: false, error: 'Não deu para salvar. Tente de novo.' };
  revalidatePath('/app/conteudos');
  return { ok: true };
}
