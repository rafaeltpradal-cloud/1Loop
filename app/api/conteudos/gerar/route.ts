import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { accessFor, lockedMsg, previewPostLimit, previewUsage, PT_TEST_USED_MSG } from '@/lib/access';
import { PT_TEST_POSTS } from '@/lib/market';
import { currentBrandId } from '@/lib/brands';
import { getUsage } from '@/lib/usage';
import { PLANS, maxVersions } from '@/lib/plans';
import { sanitizeAnswers, resolveAnswers } from '@/lib/interview';
import type { Strategy } from '@/lib/strategy';
import { itemDate, planStartFrom } from '@/lib/dates';
import { generatePost, kindOf, POST_COLUMNS, serieNumberFor, type InputImage, type PostContent } from '@/lib/content';

type Admin = ReturnType<typeof createAdminClient>;

// Baixa uma imagem da biblioteca para mandar à IA.
async function mediaImage(admin: Admin, path: string): Promise<InputImage | undefined> {
  const { data } = await admin.storage.from('media').download(path);
  if (!data) return undefined;
  const type = data.type === 'image/png' || data.type === 'image/webp' ? data.type : 'image/jpeg';
  return { data: Buffer.from(await data.arrayBuffer()).toString('base64'), mediaType: type };
}

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/conteudos/gerar { index } → gera (ou refaz) o conteúdo de um post do calendário.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { index?: unknown; historia?: unknown };
  const index = Number(body.index);
  // "Contar uma história": a situação real vira a base do post (só em dia ainda sem post).
  const historia = typeof body.historia === 'string' ? body.historia.trim().slice(0, 2500) : '';
  if (typeof body.historia === 'string' && historia.length < 20) return NextResponse.json({ error: 'Conte um pouco mais: pelo menos uma ou duas frases.' }, { status: 400 });
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });

  const brandId = await currentBrandId(user.id);
  const [access, { data: strategyRow }, { data: interview }] = await Promise.all([
    accessFor(user),
    supabase.from('strategies').select('id, data, created_at').eq('user_id', user.id).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('interviews').select('answers').eq('user_id', user.id).eq('brand_id', brandId).maybeSingle(),
  ]);
  if (access.mode === 'blocked') return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  if (!strategyRow) return NextResponse.json({ error: 'Gere sua estratégia antes dos conteúdos.' }, { status: 400 });

  const strategy = strategyRow.data as Strategy;
  const item = strategy.calendario?.[index];
  if (!item) return NextResponse.json({ error: 'Post não encontrado no calendário.' }, { status: 404 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('posts')
    .select('id, versions, content')
    .eq('strategy_id', strategyRow.id)
    .eq('item_index', index)
    .eq('user_id', user.id)
    .maybeSingle();
  if (historia && existing) return NextResponse.json({ error: 'Este dia já tem post. Escolha um dia ainda vazio.' }, { status: 400 });
  const plan = access.plan;
  // Prévia (sem cartão): até 3 posts novos, sem refazer.
  if (access.mode === 'preview') {
    if (existing)
      return NextResponse.json({ error: lockedMsg(access.market, 'Seu teste grátis acabou. Assine para refazer e ajustar posts com a IA.'), limit: true, paywall: true }, { status: 429 });
    if ((await previewUsage(user.id)).posts >= previewPostLimit(access.market))
      return NextResponse.json({ error: lockedMsg(access.market, 'Seu teste grátis acabou. Assine para gerar os próximos posts.'), limit: true, paywall: true }, { status: 429 });
  }
  // Portugal, antes de assinar: só o post de teste (pode refazer e ajustar esse).
  if (access.status === 'trial_post' && !existing && (await previewUsage(user.id)).posts >= PT_TEST_POSTS)
    return NextResponse.json({ error: PT_TEST_USED_MSG, limit: true, paywall: true }, { status: 429 });
  if (existing && existing.versions >= maxVersions(plan))
    return NextResponse.json(
      { error: `Este post já foi refeito ${PLANS[plan].refacoes} vezes, o máximo do seu plano. Use "Peça à IA" ou edite o texto direto na tela.`, limit: true },
      { status: 429 },
    );

  // Post novo: entra na cota do mês da marca; passou dela, usa um post extra de pacote.
  let extra = false;
  if (!existing && access.mode === 'paid') {
    const usage = await getUsage(admin, user.id, brandId, plan);
    if (usage.posts.used >= usage.posts.max) {
      if (usage.extras.available <= 0)
        return NextResponse.json(
          {
            error: `Você já gerou os ${usage.posts.max} posts de ${usage.month}. Compre um pacote extra ou espere 1º de ${usage.nextMonth}.`,
            limit: true,
          },
          { status: 429 },
        );
      extra = true;
    }
  }

  const date = itemDate(item, planStartFrom(strategyRow.created_at as string));
  const kind = kindOf(item.formato);
  const serieNumero = kind === 'imagem' ? serieNumberFor(strategy.calendario, index, strategy.serie?.inicio) : undefined;

  try {
    const answers = resolveAnswers(sanitizeAnswers(interview?.answers ?? {}));
    const prev = existing?.content as PostContent | undefined;
    // A IA enxerga a foto do post e até 3 referências de estilo.
    const { data: media } = await admin.from('media').select('id, path, kind').eq('user_id', user.id).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(200);
    const fotoRow = prev?.foto ? (media ?? []).find((m) => m.id === prev.foto) : undefined;
    const refRows = (media ?? []).filter((m) => m.kind === 'referencia').slice(0, 3);
    const [foto, ...referencias] = await Promise.all([fotoRow ? mediaImage(admin, fotoRow.path) : Promise.resolve(undefined), ...refRows.map((r) => mediaImage(admin, r.path))]);
    const { content, source } = await generatePost({ strategy, item, date, answers, serieNumero, foto, referencias: referencias.filter((x): x is InputImage => !!x), historia: historia || undefined, market: access.market });
    // Mantém o estilo e a foto que a pessoa já tinha escolhido (o editor visual recomeça do modelo).
    if (prev?.estilo) content.estilo = prev.estilo;
    else if (strategy.modelo?.estilo) content.estilo = strategy.modelo.estilo;
    if (prev?.foto) content.foto = prev.foto;
    if (prev?.ajustes) content.ajustes = prev.ajustes;

    const fields = {
      date,
      rede: item.rede,
      formato: item.formato,
      pilar: item.pilar,
      objetivo: item.objetivo,
      com_rosto: item.comRosto,
      tema: historia ? (content.gancho || item.tema).slice(0, 160) : item.tema,
      status: 'rascunho',
      content,
      source,
      updated_at: new Date().toISOString(),
    };
    const query = existing
      ? admin.from('posts').update({ ...fields, versions: existing.versions + 1 }).eq('id', existing.id).eq('user_id', user.id)
      : admin.from('posts').insert({ ...fields, user_id: user.id, brand_id: brandId, strategy_id: strategyRow.id, item_index: index, versions: 1, extra });
    const { data: post, error } = await query.select(POST_COLUMNS).single();
    if (error) throw error;
    return NextResponse.json({ post });
  } catch (err) {
    console.error('[conteudos]', err);
    return NextResponse.json({ error: 'Não deu para gerar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
