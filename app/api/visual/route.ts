import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accessFor, lockedMsg } from '@/lib/access';
import { currentBrandId } from '@/lib/brands';
import { resolveAnswers, sanitizeAnswers } from '@/lib/interview';
import { isoInBrazil } from '@/lib/dates';
import type { Strategy } from '@/lib/strategy';
import type { PostContent } from '@/lib/contentTypes';
import { variantFor } from '@/lib/visual';
import { applyVisualToDrafts, ensureBrandVisual, generateVisual, mediaImage, referenceImages } from '@/lib/visualAI';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Pedidos de visual à IA por dia.
const LIMIT = { preview: 4, paid: 20 };

/**
 * POST /api/visual
 * { acao: 'post', postId, pedido? } → visual novo para um post (a partir das referências, da entrevista e do pedido).
 * { acao: 'marca', refazer?, pedido? } → cria (ou refaz) a identidade visual da marca e aplica nos rascunhos.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { acao?: string; postId?: unknown; pedido?: unknown; refazer?: unknown };
  const pedido = typeof body.pedido === 'string' ? body.pedido.trim().slice(0, 400) : '';

  const access = await accessFor(user);
  if (access.mode === 'blocked') return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  const max = access.mode === 'preview' ? LIMIT.preview : LIMIT.paid;
  const today = isoInBrazil();
  const used = (user.app_metadata?.visual as { day?: string; n?: number } | undefined) ?? {};
  const n = used.day === today ? used.n ?? 0 : 0;
  if (n >= max)
    return NextResponse.json(
      { error: access.mode === 'preview' ? lockedMsg(access, 'Seu teste grátis acabou. Assine para criar novos visuais.') : `Você já pediu ${max} visuais hoje. Amanhã libera de novo.`, paywall: access.mode === 'preview' },
      { status: 429 },
    );

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const [{ data: strategyRow }, { data: interview }] = await Promise.all([
    admin.from('strategies').select('id, data').eq('user_id', user.id).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('interviews').select('answers').eq('user_id', user.id).eq('brand_id', brandId).maybeSingle(),
  ]);
  if (!strategyRow) return NextResponse.json({ error: 'Gere sua estratégia antes.' }, { status: 400 });
  const strategy = strategyRow.data as Strategy;
  const answers = resolveAnswers(sanitizeAnswers(interview?.answers ?? {}));
  const count = async () => {
    const { data: fresh } = await admin.auth.admin.getUserById(user.id);
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? user.app_metadata), visual: { day: today, n: n + 1 } } });
  };

  try {
    if (body.acao === 'marca') {
      const refazer = body.refazer === true || !!strategy.visual;
      const visual = await ensureBrandVisual(admin, { userId: user.id, brandId, strategyId: strategyRow.id as number, strategy, answers, refazer, pedido: pedido || undefined });
      const atualizados = await applyVisualToDrafts(admin, user.id, strategyRow.id as number, visual, strategy.visual ? 'marca' : 'padrao');
      await count();
      return NextResponse.json({ visual, atualizados, restantes: max - n - 1 });
    }

    if (body.acao !== 'post') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
    const postId = Number(body.postId);
    if (!Number.isInteger(postId)) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });
    const { data: post } = await admin.from('posts').select('id, item_index, status, content').eq('id', postId).eq('user_id', user.id).maybeSingle();
    if (!post) return NextResponse.json({ error: 'Post não encontrado.' }, { status: 404 });
    if (post.status === 'publicado' || post.status === 'publicando') return NextResponse.json({ error: 'Este post já foi publicado.' }, { status: 400 });
    const c = post.content as PostContent;
    const [referencias, foto] = await Promise.all([
      referenceImages(admin, user.id, brandId),
      (async () => {
        if (!c.foto) return undefined;
        const { data: m } = await admin.from('media').select('path').eq('id', c.foto).eq('user_id', user.id).maybeSingle();
        return m ? mediaImage(admin, m.path as string) : undefined;
      })(),
    ]);
    const { visual, porque } = await generateVisual({ answers, referencias, pedido: pedido || undefined, atual: c.visual ?? strategy.visual ?? null, foto });
    // O primeiro visual da conta vira também a identidade da marca.
    if (!strategy.visual) {
      const { data: fresh } = await admin.from('strategies').select('data').eq('id', strategyRow.id).maybeSingle();
      await admin.from('strategies').update({ data: { ...((fresh?.data as Strategy | undefined) ?? strategy), visual } }).eq('id', strategyRow.id).eq('user_id', user.id);
    }
    const postVisual = { ...visual, semente: variantFor(visual, post.item_index as number).semente };
    // O editor visual recomeça do novo modelo.
    const next: PostContent = { ...c, estilo: 'marca', visual: postVisual };
    delete next.canvas;
    await admin.from('posts').update({ content: next, updated_at: new Date().toISOString() }).eq('id', postId).eq('user_id', user.id);
    await count();
    return NextResponse.json({ visual: postVisual, porque, restantes: max - n - 1 });
  } catch (err) {
    console.error('[visual]', err);
    return NextResponse.json({ error: 'Não deu para criar o visual agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
