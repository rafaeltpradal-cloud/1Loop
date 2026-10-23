import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { currentBrandId } from '@/lib/brands';
import { sanitizeAnswers, resolveAnswers } from '@/lib/interview';
import type { Strategy } from '@/lib/strategy';
import { kindOf, MAX_POST_ADJUSTS, revisePost, type InputImage, type PostContent } from '@/lib/content';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/conteudos/ajustar { postId, pedido } → a IA propõe o post ajustado.
// Não salva o texto: a pessoa vê na tela e decide salvar ou desfazer. Só conta o pedido.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { postId?: unknown; pedido?: unknown };
  const postId = Number(body.postId);
  const pedido = typeof body.pedido === 'string' ? body.pedido.trim().slice(0, 1000) : '';
  if (!Number.isInteger(postId)) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });
  if (pedido.length < 3) return NextResponse.json({ error: 'Escreva o que você quer mudar.' }, { status: 400 });

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const [{ data: subs }, { data: post }, { data: interview }] = await Promise.all([
    admin.from('subscriptions').select('status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    admin.from('posts').select('id, strategy_id, item_index, date, status, content').eq('id', postId).eq('user_id', user.id).eq('brand_id', brandId).maybeSingle(),
    admin.from('interviews').select('answers').eq('brand_id', brandId).eq('user_id', user.id).maybeSingle(),
  ]);
  if (!subs?.[0] || !ACTIVE_STATUSES.includes(subs[0].status)) return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
  if (post.status === 'publicando' || post.status === 'publicado') return NextResponse.json({ error: 'Este post já foi publicado.' }, { status: 400 });

  const current = post.content as PostContent;
  const used = current.ajustes ?? 0;
  if (used >= MAX_POST_ADJUSTS)
    return NextResponse.json({ error: `Você já fez os ${MAX_POST_ADJUSTS} pedidos de ajuste deste post. Edite o texto direto na tela.` }, { status: 429 });

  const { data: strategyRow } = await admin.from('strategies').select('data').eq('id', post.strategy_id).eq('user_id', user.id).maybeSingle();
  const strategy = strategyRow?.data as Strategy | undefined;
  const item = strategy?.calendario?.[post.item_index as number];
  if (!strategy || !item) return NextResponse.json({ error: 'A estratégia deste post não foi encontrada.' }, { status: 404 });

  // A IA olha a foto do post, se tiver.
  let foto: InputImage | undefined;
  if (current.foto) {
    const { data: m } = await admin.from('media').select('path').eq('id', current.foto).eq('user_id', user.id).maybeSingle();
    if (m) {
      const { data } = await admin.storage.from('media').download(m.path as string);
      if (data) {
        const type = data.type === 'image/png' || data.type === 'image/webp' ? data.type : 'image/jpeg';
        foto = { data: Buffer.from(await data.arrayBuffer()).toString('base64'), mediaType: type };
      }
    }
  }

  try {
    const kind = kindOf(item.formato);
    const serieNumero = kind === 'imagem' ? strategy.calendario.slice(0, (post.item_index as number) + 1).filter((c) => kindOf(c.formato) === 'imagem').length : undefined;
    const { content, resposta } = await revisePost({
      strategy,
      item,
      date: post.date as string,
      answers: resolveAnswers(sanitizeAnswers(interview?.answers ?? {})),
      serieNumero,
      foto,
      current,
      pedido,
    });
    await admin.from('posts').update({ content: { ...current, ajustes: used + 1 } }).eq('id', postId).eq('user_id', user.id);
    return NextResponse.json({ content: { ...content, ajustes: used + 1 }, resposta, left: MAX_POST_ADJUSTS - used - 1 });
  } catch (err) {
    console.error('[conteudos ajustar]', err);
    return NextResponse.json({ error: 'A IA não conseguiu ajustar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
