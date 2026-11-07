'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const onlyDigits = (s: string) => s.replace(/\D/g, '');

/** Guarda o WhatsApp da pessoa (pedido dentro do app, depois do primeiro post). */
export async function saveWhatsapp(raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sua sessão expirou. Entre de novo.' };
  let phone = onlyDigits(raw);
  if (phone.startsWith('55') && phone.length >= 12) phone = phone.slice(2);
  if (phone.length < 10 || phone.length > 11) return { ok: false, error: 'Coloque o número com DDD, ex.: (11) 91234-5678.' };
  const { error } = await createAdminClient().from('profiles').update({ phone }).eq('id', user.id);
  if (error) return { ok: false, error: 'Não deu para salvar agora. Tente de novo.' };
  return { ok: true };
}
