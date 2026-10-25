import { notFound } from 'next/navigation';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Strategy } from '@/lib/strategy';
import { autoNetworkId, kindOf, MEDIA_COLUMNS, POST_COLUMNS, type MediaItem, type PostRow, serieNumberFor } from '@/lib/contentTypes';
import { PLANS, maxVersions } from '@/lib/plans';
import { interactionsOf, type Metrics } from '@/lib/metricsShared';
import type { PostPerf } from '@/components/perf/PostPerformance';
import { NETWORKS } from '@/lib/networks';
import { PostEditor } from '@/components/content/PostEditor';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConnection, linkedinTarget } from '@/lib/publish';
import { linkedinConfigured } from '@/lib/linkedin';
import { instagramConfigured } from '@/lib/instagram';

export const metadata = { title: 'Conteúdo · 1loop creators' };

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ primeiro?: string }> }) {
  const { id } = await params;
  const { primeiro } = await searchParams;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from('posts').select(POST_COLUMNS).eq('id', postId).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle();
  if (!data) notFound();
  const post = data as unknown as PostRow;

  const [{ data: strategyRow }, { data: accounts }, { data: media }] = await Promise.all([
    supabase.from('strategies').select('data').eq('id', post.strategy_id).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle(),
    supabase.from('social_accounts').select('network, handle').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
    supabase.from('media').select(MEDIA_COLUMNS).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false }),
  ]);
  const strategy = strategyRow?.data as Strategy | undefined;

  // Número na série (#001, #002...) para as imagens de série.
  const serieNumero =
    strategy && kindOf(post.formato) === 'imagem'
      ? serieNumberFor(strategy.calendario, post.item_index, strategy.serie?.inicio)
      : undefined;

  const net = NETWORKS.find((n) => n.name === post.rede);
  const account = (accounts ?? []).find((a) => a.network === net?.id);
  const handle = account && net ? (net.prefix === '@' ? `@${account.handle}` : `${net.prefix}${account.handle}`) : undefined;

  // Publicação automática (LinkedIn e Instagram).
  let auto: { available: boolean; connected: boolean; expiresAt?: string; target?: string } = { available: false, connected: false };
  const network = autoNetworkId(post.rede);
  const configured = network === 'linkedin' ? linkedinConfigured() : network === 'instagram' ? instagramConfigured() : false;
  if (network && configured) {
    const admin = createAdminClient();
    // No LinkedIn: perfil ou página (a página com renovação automática não "vence").
    const conn = network === 'linkedin' ? await linkedinTarget(admin, ctx.brandId) : await getConnection(admin, ctx.brandId, network);
    auto = { available: true, connected: !!conn && new Date(conn.expiresAt).getTime() > Date.now(), expiresAt: conn?.expiresAt, target: conn && 'kind' in conn && conn.kind === 'page' ? conn.name : undefined };
  }

  // Desempenho do post publicado.
  let perf: PostPerf = null;
  if (post.status === 'publicado') {
    const admin = createAdminClient();
    const { data: pm } = await admin
      .from('post_metrics')
      .select('id, network, metrics, source, updated_at')
      .eq('brand_id', ctx.brandId)
      .eq('post_id', post.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pm) {
      const { data: hist } = await admin.from('post_metric_history').select('day, metrics').eq('post_metric_id', pm.id).order('day').limit(60);
      perf = {
        network: pm.network as string,
        metrics: pm.metrics as Metrics,
        source: pm.source as 'api' | 'manual',
        updatedAt: pm.updated_at as string,
        history: (hist ?? []).map((h) => interactionsOf(h.metrics as Metrics)),
      };
    }
  }

  return (
    <PostEditor
      perf={perf}
      post={post}
      brand={{ name: ctx.brands.length > 1 ? ctx.brandName : ctx.name, handle, serie: strategy?.serie.nome ?? '' }}
      serieNumero={serieNumero}
      versionsLeft={ctx.preview ? 0 : Math.max(0, maxVersions(ctx.plan) - post.versions)}
      adjustMax={ctx.preview ? 0 : PLANS[ctx.plan].postAdjusts}
      media={(media ?? []) as unknown as MediaItem[]}
      canCanvas={PLANS[ctx.plan].canvas}
      auto={auto}
      defaultTime={strategy?.ritmo.horario ?? '07:30'}
      preview={ctx.preview}
      first={primeiro === '1'}
    />
  );
}
