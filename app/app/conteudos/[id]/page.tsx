import { notFound } from 'next/navigation';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Strategy } from '@/lib/strategy';
import { autoNetworkId, kindOf, MAX_VERSIONS, MEDIA_COLUMNS, POST_COLUMNS, type MediaItem, type PostRow } from '@/lib/contentTypes';
import { PLANS } from '@/lib/plans';
import { NETWORKS } from '@/lib/networks';
import { PostEditor } from '@/components/content/PostEditor';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkedinConfigured } from '@/lib/linkedin';
import { instagramConfigured } from '@/lib/instagram';

export const metadata = { title: 'Conteúdo · 1loop creators' };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      ? strategy.calendario.slice(0, post.item_index + 1).filter((c) => kindOf(c.formato) === 'imagem').length
      : undefined;

  const net = NETWORKS.find((n) => n.name === post.rede);
  const account = (accounts ?? []).find((a) => a.network === net?.id);
  const handle = account && net ? (net.prefix === '@' ? `@${account.handle}` : `${net.prefix}${account.handle}`) : undefined;

  // Publicação automática (LinkedIn e Instagram).
  let auto: { available: boolean; connected: boolean; expiresAt?: string } = { available: false, connected: false };
  const network = autoNetworkId(post.rede);
  const configured = network === 'linkedin' ? linkedinConfigured() : network === 'instagram' ? instagramConfigured() : false;
  if (network && configured) {
    const { data: conn } = await createAdminClient()
      .from('social_connections')
      .select('expires_at')
      .eq('user_id', ctx.userId).eq('brand_id', ctx.brandId)
      .eq('network', network)
      .maybeSingle();
    auto = { available: true, connected: !!conn && new Date(conn.expires_at as string).getTime() > Date.now(), expiresAt: (conn?.expires_at as string) ?? undefined };
  }

  return (
    <PostEditor
      post={post}
      brand={{ name: ctx.brands.length > 1 ? ctx.brandName : ctx.name, handle, serie: strategy?.serie.nome ?? '' }}
      serieNumero={serieNumero}
      versionsLeft={Math.max(0, MAX_VERSIONS - post.versions)}
      media={(media ?? []) as unknown as MediaItem[]}
      canCanvas={PLANS[ctx.plan].canvas}
      auto={auto}
      defaultTime={strategy?.ritmo.horario ?? '07:30'}
    />
  );
}
