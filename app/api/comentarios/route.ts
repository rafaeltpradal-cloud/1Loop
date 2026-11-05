import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accessFor, lockedMsg } from '@/lib/access';
import { currentBrandId } from '@/lib/brands';
import { resolveAnswers, sanitizeAnswers } from '@/lib/interview';
import { isoInBrazil } from '@/lib/dates';
import { suggestComments } from '@/lib/comments';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Limite por dia: prévia 3, assinantes 30 (contado na conta, que a pessoa não edita).
const LIMIT = { preview: 3, paid: 30 };

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { post?: unknown; objetivo?: unknown };
  const post = typeof body.post === 'string' ? body.post.trim().slice(0, 4000) : '';
  const objetivo = typeof body.objetivo === 'string' ? body.objetivo.trim().slice(0, 200) : '';
  if (post.length < 30) return NextResponse.json({ error: 'Cole o texto do post (pelo menos uma frase completa).' }, { status: 400 });

  const access = await accessFor(user);
  if (access.mode === 'blocked') return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  const max = access.mode === 'preview' ? LIMIT.preview : LIMIT.paid;
  const today = isoInBrazil();
  const used = (user.app_metadata?.comments as { day?: string; n?: number } | undefined) ?? {};
  const n = used.day === today ? used.n ?? 0 : 0;
  if (n >= max)
    return NextResponse.json(
      { error: access.mode === 'preview' ? lockedMsg(access.market, 'Seu teste grátis acabou. Assine para continuar comentando com a IA.') : `Você usou os ${max} de hoje. Amanhã libera de novo.`, paywall: access.mode === 'preview' },
      { status: 429 },
    );

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const { data: interview } = await admin.from('interviews').select('answers').eq('user_id', user.id).eq('brand_id', brandId).maybeSingle();
  try {
    const comentarios = await suggestComments({ post, objetivo, answers: resolveAnswers(sanitizeAnswers(interview?.answers ?? {})), market: access.market });
    if (!comentarios.length) throw new Error('vazio');
    const { data: fresh } = await admin.auth.admin.getUserById(user.id);
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? user.app_metadata), comments: { day: today, n: n + 1 } } });
    return NextResponse.json({ comentarios, restantes: max - n - 1 });
  } catch (err) {
    console.error('[comentarios]', err);
    return NextResponse.json({ error: 'Não deu para sugerir agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
