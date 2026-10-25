import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto';
import { adminOrgs, exchangePagesCode, PAGES_SCOPES, type PagesMeta } from '@/lib/linkedinPages';
import { siteUrl } from '@/lib/stripe';
import { currentBrandId } from '@/lib/brands';
import { requeueAfterReconnect } from '@/lib/publish';

export const runtime = 'nodejs';

// Volta da autorização das páginas: guarda o acesso, lista as páginas e já deixa a primeira escolhida.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${siteUrl()}/app/redes?linkedin=${status}`);
    res.cookies.set('li_pg_state', '', { path: '/api/linkedin', maxAge: 0 });
    return res;
  };
  if (url.searchParams.get('error')) return back('cancelado');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = (await cookies()).get('li_pg_state')?.value;
  if (!code || !state || !expected || state !== expected) return back('erro');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/redes`);

  try {
    const t = await exchangePagesCode(code);
    const orgs = await adminOrgs(t.access_token);
    if (!orgs.length) return back('sempagina');
    const admin = createAdminClient();
    const brandId = await currentBrandId(user.id, admin);
    const { data: prev } = await admin.from('social_connections').select('external_id, meta').eq('brand_id', brandId).eq('network', 'linkedin_page').maybeSingle();
    const prevMeta = (prev?.meta as PagesMeta | null) ?? {};
    const chosen = orgs.find((o) => o.id === prev?.external_id) ?? orgs[0];
    const now = new Date();
    const meta: PagesMeta = {
      orgs,
      active: prevMeta.active ?? true,
      ...(t.refresh_token
        ? { refresh: encrypt(t.refresh_token), refreshExpiresAt: new Date(now.getTime() + (t.refresh_token_expires_in || 31536000) * 1000).toISOString() }
        : {}),
    };
    const { error } = await admin.from('social_connections').upsert(
      {
        user_id: user.id,
        brand_id: brandId,
        network: 'linkedin_page',
        external_id: chosen.id,
        name: chosen.name,
        picture: null,
        access_token: encrypt(t.access_token),
        scopes: t.scope ?? PAGES_SCOPES,
        expires_at: new Date(now.getTime() + (t.expires_in || 5184000) * 1000).toISOString(),
        meta,
        updated_at: now.toISOString(),
      },
      { onConflict: 'brand_id,network' },
    );
    if (error) throw error;
    await requeueAfterReconnect(admin, brandId, 'LinkedIn').catch((err) => console.error('[requeue pagina]', err));
    return back('pagina');
  } catch (err) {
    console.error('[linkedin paginas callback]', err);
    return back('erro');
  }
}
