// Integração com o LinkedIn (produtos self-serve: "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn").
// Publica no perfil pessoal de quem conectou. Tokens valem 60 dias e não têm renovação automática.

import { siteUrl } from '@/lib/stripe';

const API = 'https://api.linkedin.com';
export const LINKEDIN_SCOPES = 'openid profile w_member_social';
const VERSION = () => process.env.LINKEDIN_VERSION || '202608';

export const linkedinConfigured = () => !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET?.trim());
export const linkedinRedirectUri = () => `${siteUrl()}/api/linkedin/callback`;

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!.trim(),
    redirect_uri: linkedinRedirectUri(),
    state,
    scope: LINKEDIN_SCOPES,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

export class LinkedInError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function fail(res: Response, what: string): Promise<never> {
  let detail = '';
  try {
    const j = (await res.json()) as { message?: string; error_description?: string };
    detail = j.message || j.error_description || '';
  } catch {
    // sem corpo
  }
  throw new LinkedInError(`${what}: ${res.status}${detail ? ` ${detail}` : ''}`, res.status);
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: linkedinRedirectUri(),
      client_id: process.env.LINKEDIN_CLIENT_ID!.trim(),
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!.trim(),
    }),
  });
  if (!res.ok) await fail(res, 'Token do LinkedIn');
  return (await res.json()) as { access_token: string; expires_in: number; scope?: string };
}

export async function userInfo(token: string) {
  const res = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) await fail(res, 'Perfil do LinkedIn');
  return (await res.json()) as { sub: string; name?: string; picture?: string };
}

export async function revokeToken(token: string) {
  await fetch('https://www.linkedin.com/oauth/v2/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token, client_id: process.env.LINKEDIN_CLIENT_ID!.trim(), client_secret: process.env.LINKEDIN_CLIENT_SECRET!.trim() }),
  }).catch(() => undefined);
}

function restHeaders(token: string, json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': VERSION(),
    'X-Restli-Protocol-Version': '2.0.0',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

/** Sobe um arquivo (imagem ou documento) e devolve o URN para usar no post. */
async function upload(token: string, owner: string, kind: 'images' | 'documents', bytes: Uint8Array, contentType: string) {
  const init = await fetch(`${API}/rest/${kind}?action=initializeUpload`, {
    method: 'POST',
    headers: restHeaders(token),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!init.ok) await fail(init, kind === 'images' ? 'Envio de imagem' : 'Envio de documento');
  const { value } = (await init.json()) as { value: { uploadUrl: string; image?: string; document?: string } };
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const put = await fetch(value.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType }, body });
  if (!put.ok) await fail(put, 'Upload para o LinkedIn');
  const urn = value.image ?? value.document;
  if (!urn) throw new LinkedInError('O LinkedIn não devolveu o arquivo enviado', 500);
  return urn;
}

export const uploadImage = (token: string, owner: string, jpeg: Uint8Array) => upload(token, owner, 'images', jpeg, 'image/jpeg');
export const uploadDocument = (token: string, owner: string, pdf: Uint8Array) => upload(token, owner, 'documents', pdf, 'application/pdf');

/**
 * O texto do post usa o "little text format" do LinkedIn: alguns caracteres precisam de barra invertida
 * e hashtags viram {hashtag|\#|palavra}.
 */
export function littleText(text: string) {
  const escape = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (m) => `\\${m}`);
  const out: string[] = [];
  let last = 0;
  for (const m of text.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    const i = m.index ?? 0;
    out.push(escape(text.slice(last, i)));
    out.push(`{hashtag|\\#|${m[1]}}`);
    last = i + m[0].length;
  }
  out.push(escape(text.slice(last)));
  return out.join('');
}

export type LinkedInMedia = { kind: 'image'; urns: string[] } | { kind: 'document'; urn: string; title: string } | null;

export async function createPost(token: string, author: string, text: string, media: LinkedInMedia) {
  const body: Record<string, unknown> = {
    author,
    commentary: littleText(text).slice(0, 2900),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (media?.kind === 'image' && media.urns.length === 1) body.content = { media: { id: media.urns[0] } };
  if (media?.kind === 'image' && media.urns.length > 1) body.content = { multiImage: { images: media.urns.map((id) => ({ id })) } };
  if (media?.kind === 'document') body.content = { media: { id: media.urn, title: media.title.slice(0, 200) } };

  const res = await fetch(`${API}/rest/posts`, { method: 'POST', headers: restHeaders(token), body: JSON.stringify(body) });
  if (!res.ok) await fail(res, 'Publicação no LinkedIn');
  const urn = res.headers.get('x-restli-id') ?? res.headers.get('x-linkedin-id') ?? '';
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : 'https://www.linkedin.com/in/me/recent-activity/all/' };
}
