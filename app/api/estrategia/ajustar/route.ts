import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { currentBrandId } from '@/lib/brands';
import { sanitizeAnswers } from '@/lib/interview';
import { reviseStrategy, type Strategy } from '@/lib/strategy';
import { MAX_STRATEGY_ADJUSTS } from '@/lib/contentTypes';
import { isPlanId } from '@/lib/plans';

export const runtime = 'nodejs';
export const maxDuration = 120;

// POST /api/estrategia/ajustar { pedido } → a IA ajusta a estratégia atual da marca e salva.
// POST /api/estrategia/ajustar { desfazer: true } → volta para a versão de antes do último ajuste.
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { pedido?: unknown; desfazer?: unknown };

  const admin = createAdminClient();
  const brandId = await currentBrandId(user.id, admin);
  const [{ data: subs }, { data: row }, { data: interview }] = await Promise.all([
    admin.from('subscriptions').select('status').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    admin.from('strategies').select('id, plan, data').eq('user_id', user.id).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('interviews').select('answers').eq('user_id', user.id).eq('brand_id', brandId).maybeSingle(),
  ]);
  if (!subs?.[0] || !ACTIVE_STATUSES.includes(subs[0].status)) return NextResponse.json({ error: 'Sua assinatura não está ativa.' }, { status: 402 });
  if (!row) return NextResponse.json({ error: 'Gere a estratégia antes de pedir ajustes.' }, { status: 400 });
  const current = row.data as Strategy;
  const used = current.ajustes ?? 0;

  if (body.desfazer === true) {
    if (!current.anterior) return NextResponse.json({ error: 'Não há ajuste para desfazer.' }, { status: 400 });
    const restored: Strategy = { ...current.anterior, ajustes: used };
    delete restored.anterior;
    await admin.from('strategies').update({ data: restored }).eq('id', row.id).eq('user_id', user.id);
    revalidatePath('/app/estrategia');
    return NextResponse.json({ ok: true, resposta: 'Voltei a estratégia para como estava antes do último ajuste.', left: MAX_STRATEGY_ADJUSTS - used, canUndo: false });
  }

  const pedido = typeof body.pedido === 'string' ? body.pedido.trim().slice(0, 1500) : '';
  if (pedido.length < 3) return NextResponse.json({ error: 'Escreva o que você quer mudar.' }, { status: 400 });
  if (used >= MAX_STRATEGY_ADJUSTS)
    return NextResponse.json({ error: `Você já fez os ${MAX_STRATEGY_ADJUSTS} pedidos de ajuste desta estratégia. Ajuste as respostas da entrevista e gere outra versão.` }, { status: 429 });

  try {
    const plan = isPlanId(row.plan) ? row.plan : 'pro';
    const { strategy, resposta } = await reviseStrategy(current, sanitizeAnswers(interview?.answers ?? {}), plan, pedido);
    const previous: Strategy = { ...current };
    delete previous.anterior;
    const next: Strategy = { ...strategy, ajustes: used + 1, anterior: previous };
    const { error } = await admin.from('strategies').update({ data: next }).eq('id', row.id).eq('user_id', user.id);
    if (error) throw error;

    // Posts já gerados de dias que mudaram de tema, formato ou rede (para avisar na tela).
    const changed = next.calendario
      .map((c, i) => ({ c, o: current.calendario[i], i }))
      .filter(({ c, o }) => !o || o.tema !== c.tema || o.formato !== c.formato || o.rede !== c.rede)
      .map(({ i }) => i);
    let postsAfetados = 0;
    if (changed.length) {
      const { count } = await admin.from('posts').select('id', { count: 'exact', head: true }).eq('strategy_id', row.id).in('item_index', changed);
      postsAfetados = count ?? 0;
    }
    revalidatePath('/app/estrategia');
    revalidatePath('/app/conteudos');
    return NextResponse.json({ ok: true, resposta, left: MAX_STRATEGY_ADJUSTS - used - 1, canUndo: true, diasMudados: changed.length, postsAfetados });
  } catch (err) {
    console.error('[estrategia ajustar]', err);
    return NextResponse.json({ error: 'A IA não conseguiu ajustar agora. Tente de novo em instantes.' }, { status: 500 });
  }
}
