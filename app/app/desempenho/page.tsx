import { getAppContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConnection } from '@/lib/publish';
import { hasInsightsScope } from '@/lib/instagram';
import { PerformanceDashboard, type IgStatus, type PerfDay, type PerfPost } from '@/components/perf/Dashboard';

export const metadata = { title: 'Desempenho · 1loop creators' };

export default async function DesempenhoPage() {
  const ctx = await getAppContext();
  const admin = createAdminClient();
  const since = new Date(Date.now() - 95 * 86400000).toISOString();
  const [conn, { data: posts }, { data: days }] = await Promise.all([
    getConnection(admin, ctx.brandId, 'instagram'),
    admin
      .from('post_metrics')
      .select('id, network, permalink, caption, media_type, posted_at, metrics, post_id, source, updated_at')
      .eq('user_id', ctx.userId)
      .eq('brand_id', ctx.brandId)
      .gte('posted_at', since)
      .order('posted_at', { ascending: false })
      .limit(300),
    admin
      .from('account_metrics')
      .select('day, followers, reach, updated_at')
      .eq('user_id', ctx.userId)
      .eq('brand_id', ctx.brandId)
      .eq('network', 'instagram')
      .gte('day', since.slice(0, 10))
      .order('day'),
  ]);
  const ig: IgStatus = !conn ? 'sem_conexao' : hasInsightsScope(conn.scopes) ? 'ok' : 'sem_permissao';
  let updatedAt: string | null = null;
  for (const d of days ?? []) if (!updatedAt || (d.updated_at as string) > updatedAt) updatedAt = d.updated_at as string;

  return (
    <div className="page">
      <div className="pageHead">
        <div className="eyebrow">Desempenho</div>
        <h1 className="pageTitle">
          <span className="graphite">Como seus posts</span> <span className="grad">estão indo.</span>
        </h1>
        <p className="pageSub">Números do Instagram chegam sozinhos todo dia. Os do LinkedIn você anota no post publicado.</p>
      </div>
      <PerformanceDashboard posts={(posts ?? []) as unknown as PerfPost[]} days={(days ?? []) as unknown as PerfDay[]} ig={ig} updatedAt={updatedAt} />
    </div>
  );
}
