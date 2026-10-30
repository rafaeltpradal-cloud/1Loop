import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { accessFor, PREVIEW, previewUsage } from '@/lib/access';
import { sanitizeAnswers } from '@/lib/interview';
import { applyModelo, generateStrategy, type Strategy } from '@/lib/strategy';
import { kindOf } from '@/lib/contentTypes';
import { currentBrandId } from '@/lib/brands';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUsage } from '@/lib/usage';

export const runtime = 'nodejs';
export const maxDuration = 120;

// POST /api/estrategia → gera e salva a estratégia de 30 dias do usuário logado.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Não autenticado', { status: 401 });

  const brandId = await currentBrandId(user.id);
  const [access, { data: interview }] = await Promise.all([
    accessFor(user),
    supabase.from('interviews').select('answers').eq('user_id', user.id).eq('brand_id', brandId).maybeSingle(),
  ]);
  if (access.mode === 'blocked') return new NextResponse('Assinatura inativa', { status: 402 });
  if (!interview) return new NextResponse('Entrevista não encontrada', { status: 400 });

  const plan = access.plan;
  // Prévia (sem cartão): uma estratégia. Depois, só começando o teste.
  if (access.mode === 'preview' && (await previewUsage(user.id)).strategies >= PREVIEW.strategies)
    return NextResponse.json(
      { error: 'Na prévia dá para gerar a estratégia e refazê-la uma vez. Para novas versões, comece seus 7 dias grátis.', limit: true, paywall: true },
      { status: 429 },
    );
  // Limite de estratégias novas por mês (no Multi, por marca).
  const usage = await getUsage(createAdminClient(), user.id, brandId, plan);
  if (access.mode === 'paid' && usage.strategies.used >= usage.strategies.max)
    return NextResponse.json(
      {
        error: `Você já gerou as ${usage.strategies.max} estratégias de ${usage.month}. Use "Peça à IA" para ajustar a atual; novas versões voltam em 1º de ${usage.nextMonth}.`,
        limit: true,
      },
      { status: 429 },
    );
  try {
    const generated = await generateStrategy(sanitizeAnswers(interview.answers), plan);
    const { data: prevRow } = await supabase.from('strategies').select('data').eq('user_id', user.id).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    const strategy = applyModelo(generated.strategy, (prevRow?.data as Strategy | undefined) ?? null);
    const source = generated.source;
    const { error } = await supabase.from('strategies').insert({ user_id: user.id, brand_id: brandId, plan, source, data: strategy });
    if (error) throw error;
    // Primeiro post a gerar logo em seguida: o primeiro do calendário que já sai pronto para ver (texto, imagem ou carrossel).
    const cal = strategy.calendario ?? [];
    const visual = cal.findIndex((it) => ['carrossel', 'imagem', 'texto'].includes(kindOf(it.formato)));
    return NextResponse.json({ ok: true, source, firstIndex: cal.length ? Math.max(0, visual) : null });
  } catch (err) {
    console.error('[estrategia]', err);
    return new NextResponse('Falha ao gerar a estratégia', { status: 500 });
  }
}
