import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accessFor, lockedMsg } from '@/lib/access';
import { currentBrandId } from '@/lib/brands';
import { isoInBrazil } from '@/lib/dates';
import { ARTE_TIPOS, type ArteTipo } from '@/lib/arte';
import { generateArte } from '@/lib/arteAI';
import { contextText } from '@/lib/userContext';
import { kindOf, type PostContent } from '@/lib/contentTypes';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Pedidos de formato real por dia.
const LIMIT = { preview: 6, paid: 40 };

/** POST /api/conteudos/arte { postId, tipo? } → formato real novo para a imagem do post (a IA escolhe, ou usa o tipo pedido). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { postId?: unknown; tipo?: unknown };
  const postId = Number(body.postId);
  if (!Number.isInteger(postId)) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });
  const tipo = ARTE_TIPOS.some((t) => t.id === body.tipo) ? (body.tipo as ArteTipo) : undefined;

  const access = await accessFor(user);
  if (access.mode === 'blocked') return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  const max = access.mode === 'preview' ? LIMIT.preview : LIMIT.paid;
  const today = isoInBrazil();
  const used = (user.app_metadata?.arte as { day?: string; n?: number } | undefined) ?? {};
  const n = used.day === today ? used.n ?? 0 : 0;
  if (n >= max)
    return NextResponse.json(
      { error: access.mode === 'preview' ? lockedMsg(access, 'Seu teste grátis acabou. Assine para criar novos formatos.') : `Você já pediu ${max} formatos hoje. Amanhã libera de novo.`, paywall: access.mode === 'preview' },
      { status: 429 },
    );

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const { data: post } = await admin.from('posts').select('id, strategy_id, formato, status, content').eq('id', postId).eq('user_id', user.id).eq('brand_id', brandId).maybeSingle();
  if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  if (post.status === 'publicando' || post.status === 'publicado') return NextResponse.json({ error: 'Este post já foi publicado.' }, { status: 400 });
  const kind = kindOf(post.formato as string);
  if (kind !== 'imagem' && kind !== 'carrossel') return NextResponse.json({ error: 'Este formato de post não tem imagem para trocar.' }, { status: 400 });

  try {
    const c = post.content as PostContent;
    const [contexto, { data: recentes }] = await Promise.all([
      contextText(admin, user.id, brandId),
      admin.from('posts').select('content').eq('user_id', user.id).eq('strategy_id', post.strategy_id).neq('id', postId).order('updated_at', { ascending: false }).limit(6),
    ]);
    const arte = await generateArte({
      formato: post.formato as string,
      content: c,
      tipo,
      contexto: contexto || undefined,
      recentes: (recentes ?? []).map((r) => (r.content as PostContent | null)?.arte?.tipo).filter((x): x is ArteTipo => !!x),
    });
    if (!arte) return NextResponse.json({ error: 'A IA não conseguiu montar esse formato para este post. Tente outro.' }, { status: 422 });
    const next: PostContent = { ...c, estilo: 'arte', arte };
    delete next.canvas;
    await admin.from('posts').update({ content: next, updated_at: new Date().toISOString() }).eq('id', postId).eq('user_id', user.id);
    const { data: fresh } = await admin.auth.admin.getUserById(user.id);
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? user.app_metadata), arte: { day: today, n: n + 1 } } });
    return NextResponse.json({ arte });
  } catch (err) {
    console.error('[conteudos arte]', err);
    return NextResponse.json({ error: 'Não deu para criar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
