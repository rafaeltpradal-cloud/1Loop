'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/owner';

async function guard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isOwner(user?.email);
}

export type CostInput = { id?: number; name: string; category: string; amount: number; recurrence: 'mensal' | 'unico'; start: string; end?: string | null; notes?: string | null };

export async function saveCost(c: CostInput): Promise<{ ok: boolean; error?: string }> {
  if (!(await guard())) return { ok: false, error: 'Sem acesso.' };
  const name = c.name.trim().slice(0, 80);
  const amount = Math.round(Number(c.amount) * 100) / 100;
  if (!name) return { ok: false, error: 'Dê um nome ao custo.' };
  if (!(amount > 0)) return { ok: false, error: 'Informe um valor maior que zero.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.start)) return { ok: false, error: 'Data de início inválida.' };
  const row = {
    name,
    category: (c.category || 'Outros').slice(0, 40),
    amount_brl: amount,
    recurrence: c.recurrence === 'unico' ? 'unico' : 'mensal',
    start_date: c.start,
    end_date: c.end && /^\d{4}-\d{2}-\d{2}$/.test(c.end) ? c.end : null,
    notes: c.notes?.slice(0, 200) || null,
  };
  const admin = createAdminClient();
  const { error } = c.id ? await admin.from('owner_costs').update(row).eq('id', c.id) : await admin.from('owner_costs').insert(row);
  if (error) return { ok: false, error: 'Não deu para salvar.' };
  revalidatePath('/painel');
  return { ok: true };
}

export async function deleteCost(id: number): Promise<{ ok: boolean }> {
  if (!(await guard())) return { ok: false };
  await createAdminClient().from('owner_costs').delete().eq('id', id);
  revalidatePath('/painel');
  return { ok: true };
}

export async function saveUsdBrl(v: number): Promise<{ ok: boolean }> {
  if (!(await guard()) || !(v > 1 && v < 20)) return { ok: false };
  await createAdminClient().from('owner_settings').upsert({ id: 1, usd_brl: v, updated_at: new Date().toISOString() });
  revalidatePath('/painel');
  return { ok: true };
}
