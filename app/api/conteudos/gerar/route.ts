import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { sanitizeAnswers, resolveAnswers } from '@/lib/interview';
import type { Strategy } from '@/lib/strategy';
import { itemDate, planStartFrom } from '@/lib/dates';
import { generatePost, kindOf, MAX_VERSIONS, POST_COLUMNS, type PostContent } from '@/lib/content';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/conteudos/gerar { index } → gera (ou refaz) o conteúdo de um post do calendário.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { index?: unknown };
  const index = Number(body.index);
  if (!Number.isInteger(index) || index < 0) return NextResponse.json({ error: 'Post inválido.' }, { status: 400 });

  const [{ data: subs }, { data: strategyRow }, { data: interview }] = await Promise.all([
    supabase.from('subscriptions').select('status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('strategies').select('id, data, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('interviews').select('answers').eq('user_id', user.id).maybeSingle(),
  ]);
  if (!subs?.[0] || !ACTIVE_STATUSES.includes(subs[0].status)) return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
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
  if (existing && existing.versions >= MAX_VERSIONS)
    return NextResponse.json({ error: 'Este post já foi refeito o máximo de vezes. Edite o texto direto na tela.' }, { status: 429 });

  const date = itemDate(item, planStartFrom(strategyRow.created_at as string));
  const kind = kindOf(item.formato);
  const serieNumero = kind === 'imagem' ? strategy.calendario.slice(0, index + 1).filter((c) => kindOf(c.formato) === 'imagem').length : undefined;

  try {
    const answers = resolveAnswers(sanitizeAnswers(interview?.answers ?? {}));
    const { content, source } = await generatePost({ strategy, item, date, answers, serieNumero });
    // Mantém o estilo de imagem que a pessoa já tinha escolhido.
    const prevStyle = (existing?.content as PostContent | undefined)?.estilo;
    if (prevStyle) content.estilo = prevStyle;

    const fields = {
      date,
      rede: item.rede,
      formato: item.formato,
      pilar: item.pilar,
      objetivo: item.objetivo,
      com_rosto: item.comRosto,
      tema: item.tema,
      status: 'rascunho',
      content,
      source,
      updated_at: new Date().toISOString(),
    };
    const query = existing
      ? admin.from('posts').update({ ...fields, versions: existing.versions + 1 }).eq('id', existing.id).eq('user_id', user.id)
      : admin.from('posts').insert({ ...fields, user_id: user.id, strategy_id: strategyRow.id, item_index: index, versions: 1 });
    const { data: post, error } = await query.select(POST_COLUMNS).single();
    if (error) throw error;
    return NextResponse.json({ post });
  } catch (err) {
    console.error('[conteudos]', err);
    return NextResponse.json({ error: 'Não deu para gerar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
