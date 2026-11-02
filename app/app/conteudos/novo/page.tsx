import Link from 'next/link';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Strategy } from '@/lib/strategy';
import { isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { StoryPost, type Slot } from './StoryPost';

export const metadata = { title: 'Contar uma história · 1loop creators' };

// Áudio vira post: a pessoa fala (ou escreve) uma situação real e ela vira o post de um dia vazio do calendário.
export default async function NovoPostPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data: strategyRow } = await supabase
    .from('strategies')
    .select('id, data, created_at')
    .eq('user_id', ctx.userId).eq('brand_id', ctx.brandId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!strategyRow) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">Contar uma história</div>
        <h1 className="pageTitle"><span className="graphite">Primeiro a estratégia.</span></h1>
        <p className="pageSub">A história entra no calendário do seu mês. Termine a entrevista para ele existir.</p>
        <div><Link className="btn3d" href="/app/entrevista">Ir para a entrevista</Link></div>
      </div>
    );
  }

  const strategy = strategyRow.data as Strategy;
  const start = planStartFrom(strategyRow.created_at as string);
  const today = isoInBrazil();
  const { data: posts } = await supabase.from('posts').select('item_index').eq('strategy_id', strategyRow.id).eq('user_id', ctx.userId);
  const used = new Set((posts ?? []).map((p) => p.item_index as number));
  const slots: Slot[] = strategy.calendario
    .map((it, index) => ({ index, date: itemDate(it, start), rede: it.rede, formato: it.formato, tema: it.tema }))
    .filter((s) => !used.has(s.index) && s.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="pageHead">
        <div className="eyebrow">Contar uma história</div>
        <h1 className="pageTitle">
          <span className="graphite">Você conta,</span> <span className="grad">o 1loop escreve.</span>
        </h1>
        <p className="pageSub">Uma reunião, uma objeção, um erro, uma venda difícil. Fale como falaria para um colega: o post sai na sua voz, pronto para revisar.</p>
      </div>
      <StoryPost slots={slots} preview={ctx.preview} />
    </div>
  );
}
