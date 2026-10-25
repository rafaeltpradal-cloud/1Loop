import Link from 'next/link';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Strategy } from '@/lib/strategy';
import { isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { POST_COLUMNS, kindOf, serieNumberFor, type PostRow } from '@/lib/contentTypes';
import { NETWORKS } from '@/lib/networks';
import { connectedNetworks } from '@/lib/publish';
import { WeekBoard, type BoardItem } from '@/components/content/WeekBoard';
import { ContentTabs } from '@/components/content/ContentTabs';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUsage } from '@/lib/usage';
import { PREVIEW, previewUsage } from '@/lib/access';

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

  // Para o "Aprovar todos": quem está conectado, @ de cada rede e número da série das imagens.
  const admin = createAdminClient();
  const [conns, { data: accounts }] = await Promise.all([
    connectedNetworks(admin, ctx.brandId),
    supabase.from('social_accounts').select('network, handle').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
  ]);
  const handles: Record<string, string> = {};
  for (const a of accounts ?? []) {
    const net = NETWORKS.find((n) => n.id === a.network);
    if (net && a.handle) handles[net.id] = net.prefix === '@' ? `@${a.handle}` : `${net.prefix}${a.handle}`;
  }
  const serieNumbers: Record<number, number> = {};
  strategy.calendario.forEach((it, i) => {
    if (kindOf(it.formato) === 'imagem') serieNumbers[i] = serieNumberFor(strategy.calendario, i, strategy.serie?.inicio);
  });
  const approve = ctx.preview
    ? undefined
    : {
        brandName: ctx.brands.length > 1 ? ctx.brandName : ctx.name,
        handles,
        serie: strategy.serie?.nome ?? '',
        serieNumbers,
        defaultTime: strategy.ritmo?.horario ?? '07:30',
        connected: [...conns],
      };

  const usage = await usageP;
  // Na prévia a cota é de 3 posts no total.
  const pv = ctx.preview ? await previewUsage(ctx.userId) : null;
  const total = items.length;
  const done = items.filter((i) => i.post).length;

  return (
    <div className="page">
      <div className="pageHead">
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
        approve={approve}
        planStart={start}
        quota={
          pv
            ? { used: pv.posts, max: PREVIEW.posts, extras: 0, month: usage.month, nextMonth: usage.nextMonth, preview: true }
            : { used: usage.posts.used, max: usage.posts.max, extras: usage.extras.available, month: usage.month, nextMonth: usage.nextMonth }
        }
      />
    </div>
  );
}
