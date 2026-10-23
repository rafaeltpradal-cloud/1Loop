// Integração com o Instagram ("Instagram API with Instagram Login"). Publica em contas profissionais
// (Comercial ou Criador). Tokens longos valem 60 dias e podem ser renovados.

import { siteUrl } from '@/lib/stripe';

const GRAPH = 'https://graph.instagram.com';
const V = () => process.env.INSTAGRAM_API_VERSION || 'v25.0';
export const INSTAGRAM_SCOPES = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights';
export const hasInsightsScope = (scopes?: string | null) => !!scopes && scopes.includes('instagram_business_manage_insights');

export const instagramConfigured = () => !!(process.env.INSTAGRAM_APP_ID?.trim() && process.env.INSTAGRAM_APP_SECRET?.trim());
/** Enquanto a Meta não aprova o app, só contas convidadas (testadoras) conseguem conectar. Mude INSTAGRAM_ACCESS para "aberto" depois da aprovação. */
export const instagramInviteOnly = () => (process.env.INSTAGRAM_ACCESS ?? '').trim().toLowerCase() !== 'aberto';
export const instagramRedirectUri = () => `${siteUrl()}/api/instagram/callback`;
const appId = () => process.env.INSTAGRAM_APP_ID!.trim();
const secret = () => process.env.INSTAGRAM_APP_SECRET!.trim();

export class InstagramError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
  ) {
    super(message);
  }
}

async function json<T>(res: Response, what: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string }; error_message?: string };
  if (!res.ok || body.error) {
    const msg = body.error?.error_user_msg || body.error?.message || body.error_message || `HTTP ${res.status}`;
    throw new InstagramError(`${what}: ${msg}`, res.status, body.error?.code);
  }
  return body as T;
}

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    client_id: appId(),
    redirect_uri: instagramRedirectUri(),
    response_type: 'code',
    scope: INSTAGRAM_SCOPES,
    state,
    enable_fb_login: 'false',
  });
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

/** Troca o código por um token curto e depois por um token longo (60 dias). */
export async function exchangeCode(rawCode: string) {
  const code = rawCode.replace(/#_$/, '');
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appId(), client_secret: secret(), grant_type: 'authorization_code', redirect_uri: instagramRedirectUri(), code }),
  });
  const body = await json<{ data?: Array<{ access_token: string; user_id: string | number; permissions?: string }>; access_token?: string; user_id?: string | number; permissions?: string }>(
    res,
    'Token do Instagram',
  );
  const short = body.data?.[0] ?? body;
  if (!short.access_token) throw new InstagramError('O Instagram não devolveu o token', 500);

  const q = new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: secret(), access_token: short.access_token });
  const long = await json<{ access_token: string; expires_in: number }>(await fetch(`${GRAPH}/access_token?${q}`), 'Token longo do Instagram');
  const perms = short.permissions;
  return { accessToken: long.access_token, expiresIn: long.expires_in || 5184000, permissions: Array.isArray(perms) ? perms.join(',') : perms ?? INSTAGRAM_SCOPES };
}

export async function refreshToken(token: string) {
  const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
  return json<{ access_token: string; expires_in: number }>(await fetch(`${GRAPH}/refresh_access_token?${q}`), 'Renovação do Instagram');
}

export async function me(token: string) {
  const q = new URLSearchParams({ fields: 'user_id,username,name,profile_picture_url,account_type', access_token: token });
  return json<{ id: string; user_id?: string | number; username?: string; name?: string; profile_picture_url?: string; account_type?: string }>(
    await fetch(`${GRAPH}/${V()}/me?${q}`),
    'Perfil do Instagram',
  );
}

async function post<T>(path: string, token: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}/${V()}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: token }),
  });
  return json<T>(res, 'Instagram');
}

export type ContainerInput =
  | { kind: 'image'; url: string; caption?: string; carouselItem?: boolean }
  | { kind: 'carousel'; children: string[]; caption: string }
  | { kind: 'story'; url: string }
  | { kind: 'reel'; videoUrl: string; caption: string; coverUrl?: string };

/** Cria o "contêiner" de mídia (o Instagram baixa a imagem ou o vídeo pelo link). */
export async function createContainer(token: string, igUserId: string, c: ContainerInput) {
  const p: Record<string, string> = {};
  if (c.kind === 'image') {
    p.image_url = c.url;
    if (c.carouselItem) p.is_carousel_item = 'true';
    else if (c.caption) p.caption = c.caption;
  } else if (c.kind === 'carousel') {
    p.media_type = 'CAROUSEL';
    p.children = c.children.join(',');
    p.caption = c.caption;
  } else if (c.kind === 'story') {
    p.media_type = 'STORIES';
    p.image_url = c.url;
  } else {
    p.media_type = 'REELS';
    p.video_url = c.videoUrl;
    p.caption = c.caption;
    p.share_to_feed = 'true';
    if (c.coverUrl) p.cover_url = c.coverUrl;
  }
  const { id } = await post<{ id: string }>(`${igUserId}/media`, token, p);
  return id;
}

export async function containerStatus(token: string, containerId: string) {
  const q = new URLSearchParams({ fields: 'status_code,status', access_token: token });
  return json<{ status_code?: 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED'; status?: string }>(
    await fetch(`${GRAPH}/${V()}/${containerId}?${q}`),
    'Status no Instagram',
  );
}

/** Espera o contêiner ficar pronto (vídeos levam um tempo). Devolve false se ainda estiver processando. */
export async function waitReady(token: string, containerId: string, maxMs: number) {
  const until = Date.now() + maxMs;
  for (;;) {
    const s = await containerStatus(token, containerId);
    if (s.status_code === 'FINISHED' || s.status_code === 'PUBLISHED') return true;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new InstagramError(`O Instagram não conseguiu processar a mídia (${s.status ?? s.status_code})`, 422);
    if (Date.now() > until) return false;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export async function publishContainer(token: string, igUserId: string, containerId: string) {
  const { id } = await post<{ id: string }>(`${igUserId}/media_publish`, token, { creation_id: containerId });
  return id;
}

export async function permalink(token: string, mediaId: string) {
  try {
    const q = new URLSearchParams({ fields: 'permalink', access_token: token });
    const r = await json<{ permalink?: string }>(await fetch(`${GRAPH}/${V()}/${mediaId}?${q}`), 'Link do post');
    return r.permalink ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Desempenho (insights)
// ---------------------------------------------------------------------------

export type IgMedia = {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_product_type?: 'FEED' | 'REELS' | 'STORY' | 'AD';
  permalink?: string;
  timestamp: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
};

export async function profileStats(token: string) {
  const q = new URLSearchParams({ fields: 'user_id,username,followers_count,follows_count,media_count', access_token: token });
  return json<{ followers_count?: number; follows_count?: number; media_count?: number; username?: string }>(await fetch(`${GRAPH}/${V()}/me?${q}`), 'Perfil do Instagram');
}

/** Posts mais recentes do perfil (inclui os que não saíram pelo 1loop). */
export async function listMedia(token: string, igUserId: string, limit = 40) {
  const q = new URLSearchParams({
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url,like_count,comments_count',
    limit: String(limit),
    access_token: token,
  });
  const r = await json<{ data?: IgMedia[] }>(await fetch(`${GRAPH}/${V()}/${igUserId}/media?${q}`), 'Posts do Instagram');
  return r.data ?? [];
}

export type MediaMetrics = { views?: number; reach?: number; likes?: number; comments?: number; saved?: number; shares?: number; interactions?: number };

/** Números de um post. Pode levar até 48 h para aparecer. */
export async function mediaInsights(token: string, mediaId: string): Promise<MediaMetrics> {
  const q = new URLSearchParams({ metric: 'views,reach,likes,comments,saved,shares,total_interactions', access_token: token });
  const r = await json<{ data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value: number } }> }>(
    await fetch(`${GRAPH}/${V()}/${mediaId}/insights?${q}`),
    'Números do post',
  );
  const out: MediaMetrics = {};
  for (const m of r.data ?? []) {
    const v = m.values?.[0]?.value ?? m.total_value?.value;
    if (typeof v !== 'number') continue;
    const key = m.name === 'total_interactions' ? 'interactions' : (m.name as keyof MediaMetrics);
    out[key] = v;
  }
  return out;
}

/** Alcance do perfil por dia (até 30 dias por pedido). */
export async function dailyReach(token: string, igUserId: string, sinceSec: number, untilSec: number) {
  const q = new URLSearchParams({ metric: 'reach', period: 'day', since: String(sinceSec), until: String(untilSec), access_token: token });
  const r = await json<{ data?: Array<{ name: string; values?: Array<{ value: number; end_time: string }> }> }>(
    await fetch(`${GRAPH}/${V()}/${igUserId}/insights?${q}`),
    'Alcance do perfil',
  );
  return (r.data?.find((d) => d.name === 'reach')?.values ?? []).map((v) => ({ day: v.end_time.slice(0, 10), value: v.value }));
}
