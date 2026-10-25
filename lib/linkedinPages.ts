// Publicar em PÁGINAS de empresa no LinkedIn (Community Management API).
// O LinkedIn exige um app separado só com esse produto, então as chaves são outras:
// LINKEDIN_PAGES_CLIENT_ID e LINKEDIN_PAGES_CLIENT_SECRET. Sem elas, a opção não aparece.
// A conexão fica em social_connections com network = 'linkedin_page':
//   external_id = id da página escolhida, name = nome da página,
//   meta = { orgs: [{ id, name }], active: boolean (publicar na página em vez do perfil), refresh?: token criptografado }.
import { siteUrl } from '@/lib/stripe';
import { LinkedInError } from '@/lib/linkedin';

const API = 'https://api.linkedin.com';
export const PAGES_SCOPES = 'rw_organization_admin w_organization_social r_organization_social';
const VERSION = () => process.env.LINKEDIN_VERSION || '202608';

const id = () => process.env.LINKEDIN_PAGES_CLIENT_ID?.trim() ?? '';
const secret = () => process.env.LINKEDIN_PAGES_CLIENT_SECRET?.trim() ?? '';

export const pagesConfigured = () => !!(id() && secret());
export const pagesRedirectUri = () => `${siteUrl()}/api/linkedin/paginas/callback`;

export type Org = { id: string; name: string };
export type PagesMeta = { orgs?: Org[]; active?: boolean; refresh?: string; refreshExpiresAt?: string };

export function pagesAuthorizeUrl(state: string) {
  const p = new URLSearchParams({ response_type: 'code', client_id: id(), redirect_uri: pagesRedirectUri(), state, scope: PAGES_SCOPES });
  return `https://www.linkedin.com/oauth/v2/authorization?${p}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number; scope?: string };

async function token(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: id(), client_secret: secret() }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error_description?: string };
    throw new LinkedInError(`Token das páginas: ${res.status} ${j.error_description ?? ''}`.trim(), res.status);
  }
  return (await res.json()) as TokenResponse;
}

export const exchangePagesCode = (code: string) => token({ grant_type: 'authorization_code', code, redirect_uri: pagesRedirectUri() });
/** Apps com Community Management recebem refresh token (vale ~1 ano): renova sem pedir login de novo. */
export const refreshPagesToken = (refresh: string) => token({ grant_type: 'refresh_token', refresh_token: refresh });

function headers(t: string) {
  return { Authorization: `Bearer ${t}`, 'LinkedIn-Version': VERSION(), 'X-Restli-Protocol-Version': '2.0.0' };
}

/** Páginas em que a pessoa é administradora ou pode publicar conteúdo. */
export async function adminOrgs(t: string): Promise<Org[]> {
  const ids = new Set<string>();
  for (const role of ['ADMINISTRATOR', 'CONTENT_ADMINISTRATOR']) {
    const res = await fetch(`${API}/rest/organizationAcls?q=roleAssignee&role=${role}&state=APPROVED&count=50`, { headers: headers(t) });
    if (!res.ok) continue;
    const j = (await res.json()) as { elements?: { organization?: string }[] };
    for (const e of j.elements ?? []) {
      const m = /urn:li:organization:(\d+)/.exec(e.organization ?? '');
      if (m) ids.add(m[1]);
    }
  }
  const out: Org[] = [];
  for (const orgId of ids) {
    // Uma chamada por página (o nível de desenvolvimento não permite busca em lote).
    const res = await fetch(`${API}/rest/organizations/${orgId}`, { headers: headers(t) });
    const j = res.ok ? ((await res.json()) as { localizedName?: string; vanityName?: string }) : {};
    out.push({ id: orgId, name: j.localizedName || j.vanityName || `Página ${orgId}` });
  }
  return out;
}
