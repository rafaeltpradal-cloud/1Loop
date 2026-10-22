'use server';

import { createClient } from '@/lib/supabase/server';
import { sanitizeAnswers } from '@/lib/interview';

// Salva as respostas a cada passo, para a pessoa poder parar e voltar depois.
export async function saveAnswers(raw: unknown, completed = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const answers = sanitizeAnswers(raw);
  const { error } = await supabase.from('interviews').upsert(
    {
      user_id: user.id,
      answers,
      updated_at: new Date().toISOString(),
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    },
    { onConflict: 'user_id' },
  );
  return { ok: !error };
}
