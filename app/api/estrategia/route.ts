import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { sanitizeAnswers } from '@/lib/interview';
import { generateStrategy } from '@/lib/strategy';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';
export const maxDuration = 120;

// POST /api/estrategia → gera e salva a estratégia de 30 dias do usuário logado.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Não autenticado', { status: 401 });

  const [{ data: subs }, { data: interview }] = await Promise.all([
    supabase.from('subscriptions').select('plan, status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    supabase.from('interviews').select('answers').eq('user_id', user.id).maybeSingle(),
  ]);
  const sub = subs?.[0];
  if (!sub || !ACTIVE_STATUSES.includes(sub.status)) return new NextResponse('Assinatura inativa', { status: 402 });
  if (!interview) return new NextResponse('Entrevista não encontrada', { status: 400 });

  const plan = isPlanId(sub.plan) ? sub.plan : 'pro';
  try {
    const { strategy, source } = await generateStrategy(sanitizeAnswers(interview.answers), plan);
    const { error } = await supabase.from('strategies').insert({ user_id: user.id, plan, source, data: strategy });
    if (error) throw error;
    return NextResponse.json({ ok: true, source });
  } catch (err) {
    console.error('[estrategia]', err);
    return new NextResponse('Falha ao gerar a estratégia', { status: 500 });
  }
}
