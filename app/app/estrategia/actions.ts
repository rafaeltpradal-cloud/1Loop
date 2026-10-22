'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isISODate, itemDate, planStartFrom } from '@/lib/dates';
import type { Strategy } from '@/lib/strategy';

export type MoveResult = { ok: true } | { ok: false; error: string };

/**
 * Muda um post do calendário de dia. `date = null` volta para o dia sugerido pela estratégia.
 * A tabela de estratégias é só leitura para o usuário; a gravação passa pelo servidor,
 * sempre filtrando pelo dono da estratégia.
 */
export async function movePost(strategyId: number, index: number, date: string | null): Promise<MoveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  if (!Number.isInteger(strategyId) || !Number.isInteger(index) || index < 0) return { ok: false, error: 'Post inválido.' };
  if (date !== null && !isISODate(date)) return { ok: false, error: 'Data inválida.' };

  const admin = createAdminClient();
  const { data: row, error } = await admin.from('strategies').select('id, data, created_at').eq('id', strategyId).eq('user_id', user.id).maybeSingle();
  if (error || !row) return { ok: false, error: 'Estratégia não encontrada.' };

  const s = row.data as Strategy;
  const item = s.calendario?.[index];
  if (!item) return { ok: false, error: 'Post não encontrado.' };
  if (date === null) delete item.data;
  else item.data = date;

  const { error: upErr } = await admin.from('strategies').update({ data: s }).eq('id', strategyId).eq('user_id', user.id);
  if (upErr) return { ok: false, error: 'Não deu para salvar. Tente de novo.' };

  // Se o conteúdo desse post já foi gerado, ele acompanha o novo dia.
  await admin
    .from('posts')
    .update({ date: itemDate(item, planStartFrom(row.created_at as string)) })
    .eq('strategy_id', strategyId)
    .eq('item_index', index)
    .eq('user_id', user.id);

  revalidatePath('/app/estrategia');
  revalidatePath('/app/conteudos');
  return { ok: true };
}
