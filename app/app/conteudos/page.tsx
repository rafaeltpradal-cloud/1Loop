import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Strategy } from '@/lib/strategy';
import { isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { POST_COLUMNS, type PostRow } from '@/lib/contentTypes';
import { WeekBoard, type BoardItem } from '@/components/content/WeekBoard';
import { ContentTabs } from '@/components/content/ContentTabs';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUsage } from '@/lib/usage';

export const metadata = { title: 'Conteúdos · 1loop creators' };

export default async function ConteudosPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  // Começa a contar o uso do mês junto com as outras buscas.
  const usageP = getUsage(createAdminClient(), ctx.userId, ctx.brandId, ctx.plan);
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
        <div className="eyebrow">Conteúdos</div>
        <h1 className="pageTitle"><span className="graphite">Primeiro a estratégia, depois os conteúdos.</span></h1>
        <p className="pageSub">Os posts nascem do calendário da estratégia.</p>
        <div><Link className="btn3d" href="/app/estrategia">Ver minha estratégia</Link></div>
      </div>
    );
  }

  const strategy = strategyRow.data as Strategy;
  const start = planStartFrom(strategyRow.created_at as string);
  const { data: posts } = await supabase.from('posts').select(POST_COLUMNS).eq('strategy_id', strategyRow.id).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId);
  const byIndex = new Map(((posts ?? []) as unknown as PostRow[]).map((p) => [p.item_index, p]));

  const items: BoardItem[] = strategy.calendario.map((it, index) => ({
    index,
    date: itemDate(it, start),
    rede: it.rede,
    formato: it.formato,
    tema: it.tema,
    objetivo: it.objetivo,
    comRosto: it.comRosto,
    pilar: strategy.pilares[it.pilar]?.nome ?? '',
    post: byIndex.get(index) ?? null,
  }));

  const usage = await usageP;
  const total = items.length;
  const done = items.filter((i) => i.post).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1180 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Conteúdos</div>
        <h1 className="pageTitle">
          <span className="graphite">Conteúdos da</span> <span className="grad">semana.</span>
        </h1>
        <span className="pageSub">{done} de {total} posts prontos</span>
      </div>
      <ContentTabs active="semana" />
      <WeekBoard
        items={items}
        today={isoInBrazil()}
        planStart={start}
        quota={{ used: usage.posts.used, max: usage.posts.max, extras: usage.extras.available, month: usage.month, nextMonth: usage.nextMonth }}
      />
    </div>
  );
}
