// Desempenho: busca e guarda os números dos posts e do perfil.
// Instagram: pela API (precisa da permissão de insights). LinkedIn: anotado à mão.

import { createAdminClient } from '@/lib/supabase/admin';
import { getConnection } from '@/lib/publish';
import { isoInBrazil } from '@/lib/dates';
import * as ig from '@/lib/instagram';
import { type Metrics } from '@/lib/metricsShared';

export * from '@/lib/metricsShared';

type Admin = ReturnType<typeof createAdminClient>;

const clean = (m: Record<string, unknown>): Metrics => {
  const out: Metrics = {};
  for (const k of ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'interactions', 'impressions'] as const) {
    const v = Number(m[k]);
    if (Number.isFinite(v) && v >= 0) out[k] = Math.round(v);
  }
  return out;
};

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x);
  }));
}

export type SyncResult = { ok: true; posts: number } | { ok: false; reason: 'sem_conexao' | 'sem_permissao' | 'erro'; message?: string };

/** Atualiza os números do Instagram de uma marca. */
export async function syncInstagram(admin: Admin, brandId: number): Promise<SyncResult> {
  const conn = await getConnection(admin, brandId, 'instagram');
  if (!conn) return { ok: false, reason: 'sem_conexao' };
  if (!ig.hasInsightsScope(conn.scopes)) return { ok: false, reason: 'sem_permissao' };
  const { data: brand } = await admin.from('brands').select('user_id').eq('id', brandId).maybeSingle();
  if (!brand) return { ok: false, reason: 'erro' };
  const userId = brand.user_id as string;
  const token = conn.token();
  const today = isoInBrazil();

  try {
    // Perfil: seguidores de hoje e alcance dos últimos 30 dias.
    const profile = await ig.profileStats(token);
    const now = Math.floor(Date.now() / 1000);
    const reach = await ig.dailyReach(token, conn.externalId, now - 29 * 86400, now).catch(() => []);
    const rows = new Map<string, { followers?: number; reach?: number }>();
    for (const r of reach) rows.set(r.day, { reach: r.value });
    rows.set(today, { ...(rows.get(today) ?? {}), followers: profile.followers_count });
    for (const [day, v] of rows) {
      await admin
        .from('account_metrics')
        .upsert({ user_id: userId, brand_id: brandId, network: 'instagram', day, ...v, updated_at: new Date().toISOString() }, { onConflict: 'brand_id,network,day' });
    }

    // Posts: os 40 mais recentes (stories somem em 24 h e ficam de fora).
    const media = (await ig.listMedia(token, conn.externalId, 40)).filter((m) => m.media_product_type !== 'STORY');
    const { data: ours } = await admin.from('posts').select('id, external_url').eq('brand_id', brandId).eq('rede', 'Instagram').not('external_url', 'is', null);
    const byLink = new Map((ours ?? []).map((p) => [String(p.external_url).replace(/\/$/, ''), p.id as number]));

    let count = 0;
    await pool(media, 5, async (m) => {
      let metrics: Metrics = { likes: m.like_count, comments: m.comments_count };
      try {
        metrics = { ...metrics, ...(await ig.mediaInsights(token, m.id)) };
      } catch {
        // post muito novo ou formato sem números: fica com curtidas e comentários
      }
      const metricsClean = clean(metrics as Record<string, unknown>);
      const { data: row } = await admin
        .from('post_metrics')
        .upsert(
          {
            user_id: userId,
            brand_id: brandId,
            post_id: m.permalink ? byLink.get(m.permalink.replace(/\/$/, '')) ?? null : null,
            network: 'instagram',
            external_id: m.id,
            permalink: m.permalink ?? null,
            caption: (m.caption ?? '').slice(0, 300),
            media_type: m.media_product_type === 'REELS' ? 'REELS' : m.media_type,
            thumb_url: m.thumbnail_url ?? m.media_url ?? null,
            posted_at: m.timestamp,
            metrics: metricsClean,
            source: 'api',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'brand_id,network,external_id' },
        )
        .select('id')
        .single();
      if (row) await admin.from('post_metric_history').upsert({ post_metric_id: row.id, day: today, metrics: metricsClean }, { onConflict: 'post_metric_id,day' });
      count++;
    });
    return { ok: true, posts: count };
  } catch (err) {
    console.error('[desempenho instagram]', brandId, err);
    return { ok: false, reason: 'erro', message: err instanceof Error ? err.message : undefined };
  }
}

/** Coleta diária: todas as marcas com Instagram conectado (as mais antigas primeiro). */
export async function syncAll() {
  const admin = createAdminClient();
  const { data } = await admin.from('social_connections').select('brand_id, scopes').eq('network', 'instagram').limit(200);
  const results: Array<{ brand: number; ok: boolean }> = [];
  const sixHoursAgo = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  for (const c of (data ?? []).filter((c) => ig.hasInsightsScope(c.scopes as string))) {
    // O endereço é aberto (o agendador chama sem senha): marca atualizada há pouco fica de fora.
    const { data: last } = await admin.from('account_metrics').select('updated_at').eq('brand_id', c.brand_id).gte('updated_at', sixHoursAgo).limit(1);
    if (last?.length) continue;
    const r = await syncInstagram(admin, c.brand_id as number);
    results.push({ brand: c.brand_id as number, ok: r.ok });
  }
  return results;
}

/** Números anotados à mão (LinkedIn e outras redes sem API). */
export async function saveManual(admin: Admin, userId: string, brandId: number, post: { id: number; rede: string; external_url: string | null; published_at: string | null; date: string; tema: string }, raw: Record<string, unknown>) {
  const metrics = clean(raw);
  const { data: row, error } = await admin
    .from('post_metrics')
    .upsert(
      {
        user_id: userId,
        brand_id: brandId,
        post_id: post.id,
        network: post.rede.toLowerCase(),
        external_id: `post:${post.id}`,
        permalink: post.external_url,
        caption: post.tema.slice(0, 300),
        media_type: null,
        posted_at: post.published_at ?? `${post.date}T12:00:00-03:00`,
        metrics,
        source: 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'brand_id,network,external_id' },
    )
    .select('id')
    .single();
  if (error || !row) return false;
  await admin.from('post_metric_history').upsert({ post_metric_id: row.id, day: isoInBrazil(), metrics }, { onConflict: 'post_metric_id,day' });
  return true;
}
