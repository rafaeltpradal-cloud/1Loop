import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accessFor, lockedMsg, previewPostLimit, previewUsage, PT_TEST_USED_MSG } from '@/lib/access';
import { PT_TEST_POSTS } from '@/lib/market';
import { currentBrandId } from '@/lib/brands';
import { getUsage } from '@/lib/usage';
import { resolveAnswers, sanitizeAnswers } from '@/lib/interview';
import type { Strategy } from '@/lib/strategy';
import { isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { POST_COLUMNS, type InputImage, type PostContent } from '@/lib/content';
import { writeDraft } from '@/lib/createPost';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Pedidos à barra de IA por dia: prévia 5, assinantes 40 (contado na conta, que a pessoa não edita).
const LIMIT = { preview: 5, paid: 40 };

type Body = { acao?: unknown; pedido?: unknown; texto?: unknown; foto?: unknown; rede?: unknown; index?: unknown; hashtags?: unknown };

/**
 * POST /api/conteudos/criar
 *  { acao: 'ia', pedido, texto, foto?, rede }        → a IA devolve { legenda, hashtags } (não salva)
 *  { acao: 'salvar', index, texto, foto?, hashtags } → cria o post no dia escolhido do calendário
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const texto = typeof body.texto === 'string' ? body.texto.trim().slice(0, 5000) : '';
  const fotoId = Number(body.foto);
  const hasFoto = Number.isInteger(fotoId) && fotoId > 0;

  const access = await accessFor(user);
  if (access.mode === 'blocked') return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);

  let fotoRow: { id: number; path: string } | null = null;
  if (hasFoto) {
    const { data } = await admin.from('media').select('id, path').eq('id', fotoId).eq('user_id', user.id).neq('kind', 'video').maybeSingle();
    if (!data) return NextResponse.json({ error: 'Foto não encontrada. Escolha de novo.' }, { status: 400 });
    fotoRow = data;
  }

  if (body.acao === 'ia') {
    const pedido = typeof body.pedido === 'string' ? body.pedido.trim().slice(0, 1500) : '';
    if (!pedido && !texto && !fotoRow) return NextResponse.json({ error: 'Conte para a IA o que você quer, ou coloque uma foto ou um texto.' }, { status: 400 });
    const max = access.mode === 'preview' ? LIMIT.preview : LIMIT.paid;
    const today = isoInBrazil();
    const used = (user.app_metadata?.criar as { day?: string; n?: number } | undefined) ?? {};
    const n = used.day === today ? used.n ?? 0 : 0;
    if (n >= max)
      return NextResponse.json(
        { error: access.mode === 'preview' ? lockedMsg(access.market, 'Seu teste grátis acabou. Assine para continuar usando a IA.') : `Você usou os ${max} pedidos de hoje. Amanhã libera de novo.`, paywall: access.mode === 'preview' },
        { status: 429 },
      );
    const { data: interview } = await admin.from('interviews').select('answers').eq('user_id', user.id).eq('brand_id', brandId).maybeSingle();
    try {
      let foto: InputImage | undefined;
      if (fotoRow) {
        const { data } = await admin.storage.from('media').download(fotoRow.path);
        if (data) foto = { data: Buffer.from(await data.arrayBuffer()).toString('base64'), mediaType: data.type === 'image/png' || data.type === 'image/webp' ? data.type : 'image/jpeg' };
      }
      const rede = typeof body.rede === 'string' ? body.rede : 'LinkedIn';
      const draft = await writeDraft({ pedido, texto, rede, foto, answers: resolveAnswers(sanitizeAnswers(interview?.answers ?? {})), market: access.market });
      const { data: fresh } = await admin.auth.admin.getUserById(user.id);
      await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? user.app_metadata), criar: { day: today, n: n + 1 } } });
      return NextResponse.json({ ...draft, restantes: max - n - 1 });
    } catch (err) {
      console.error('[criar ia]', err);
      return NextResponse.json({ error: 'Não deu para escrever agora. Tente de novo em instantes.' }, { status: 500 });
    }
  }

  if (body.acao !== 'salvar') return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });

  // Salvar: o post entra num dia vazio do calendário e abre no editor de sempre.
  const index = Number(body.index);
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: 'Escolha o dia do post.' }, { status: 400 });
  if (texto.length < 10) return NextResponse.json({ error: 'Escreva a legenda (ou peça para a IA) antes de salvar.' }, { status: 400 });

  const { data: strategyRow } = await admin.from('strategies').select('id, data, created_at').eq('user_id', user.id).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!strategyRow) return NextResponse.json({ error: 'Gere sua estratégia antes.' }, { status: 400 });
  const strategy = strategyRow.data as Strategy;
  const item = strategy.calendario?.[index];
  if (!item) return NextResponse.json({ error: 'Dia não encontrado no calendário.' }, { status: 404 });
  const { data: existing } = await admin.from('posts').select('id').eq('strategy_id', strategyRow.id).eq('item_index', index).eq('user_id', user.id).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Este dia já tem post. Escolha um dia ainda vazio.' }, { status: 400 });

  if (access.mode === 'preview' && (await previewUsage(user.id)).posts >= previewPostLimit(access.market))
    return NextResponse.json({ error: lockedMsg(access.market, 'Seu teste grátis acabou. Assine para voltar a criar posts.'), limit: true, paywall: true }, { status: 429 });
  if (access.status === 'trial_post' && (await previewUsage(user.id)).posts >= PT_TEST_POSTS)
    return NextResponse.json({ error: PT_TEST_USED_MSG, limit: true, paywall: true }, { status: 429 });
  let extra = false;
  if (access.mode === 'paid') {
    const usage = await getUsage(admin, user.id, brandId, access.plan);
    if (usage.posts.used >= usage.posts.max) {
      if (usage.extras.available <= 0)
        return NextResponse.json({ error: `Você já usou os ${usage.posts.max} posts de ${usage.month}. Compre um pacote extra ou espere 1º de ${usage.nextMonth}.`, limit: true }, { status: 429 });
      extra = true;
    }
  }

  const hashtags = Array.isArray(body.hashtags) ? body.hashtags.map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean).slice(0, 10) : [];
  const gancho = texto.split('\n').find((l) => l.trim())?.trim().slice(0, 200) ?? '';
  const content: PostContent = { gancho, legenda: texto, hashtags, cta: '', ...(fotoRow ? { foto: fotoRow.id } : {}) };
  const { data: post, error } = await admin
    .from('posts')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      strategy_id: strategyRow.id,
      item_index: index,
      versions: 1,
      extra,
      date: itemDate(item, planStartFrom(strategyRow.created_at as string)),
      rede: item.rede,
      formato: fotoRow ? 'Post com foto' : 'Post de texto',
      pilar: item.pilar,
      objetivo: item.objetivo,
      com_rosto: item.comRosto,
      tema: gancho.slice(0, 160) || item.tema,
      status: 'rascunho',
      content,
      source: 'ai',
      updated_at: new Date().toISOString(),
    })
    .select(POST_COLUMNS)
    .single();
  if (error) {
    console.error('[criar salvar]', error);
    return NextResponse.json({ error: 'Não deu para salvar agora. Tente de novo.' }, { status: 500 });
  }
  return NextResponse.json({ post });
}
