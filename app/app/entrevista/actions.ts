'use server';

import { createClient } from '@/lib/supabase/server';
import { sanitizeAnswers } from '@/lib/interview';
import { createAdminClient } from '@/lib/supabase/admin';
import { currentBrandId } from '@/lib/brands';

// Salva as respostas a cada passo, para a pessoa poder parar e voltar depois.
export async function saveAnswers(raw: unknown, completed = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const answers = sanitizeAnswers(raw);
  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  // Cada marca tem a própria entrevista.
  const { error } = await admin.from('interviews').upsert(
    {
      user_id: user.id,
      brand_id: brandId,
      answers,
      updated_at: new Date().toISOString(),
      ...(completed ? { completed_at: new Date().toISOString() } : {}),
    },
    { onConflict: 'brand_id' },
  );
  return { ok: !error };
}
