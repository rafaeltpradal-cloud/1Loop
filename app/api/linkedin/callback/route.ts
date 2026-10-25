import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto';
import { exchangeCode, LINKEDIN_SCOPES, userInfo } from '@/lib/linkedin';
import { siteUrl } from '@/lib/stripe';
import { currentBrandId } from '@/lib/brands';
import { requeueAfterReconnect } from '@/lib/publish';

export const runtime = 'nodejs';

// GET /api/linkedin/callback?code=...&state=... → guarda a conexão e volta para Redes.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${siteUrl()}/app/redes?linkedin=${status}`);
    res.cookies.set('li_state', '', { path: '/api/linkedin', maxAge: 0 });
    return res;
  };

  if (url.searchParams.get('error')) return back('cancelado');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const expected = jar.get('li_state')?.value;
  if (!code || !state || !expected || state !== expected) return back('erro');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/redes`);

  try {
    const token = await exchangeCode(code);
    const me = await userInfo(token.access_token);
    const admin = createAdminClient();
    const brandId = await currentBrandId(user.id, admin);
    const now = new Date();
    const { error } = await admin.from('social_connections').upsert(
      {
        user_id: user.id,
        brand_id: brandId,
        network: 'linkedin',
        external_id: me.sub,
        name: me.name ?? null,
        picture: me.picture ?? null,
        access_token: encrypt(token.access_token),
        scopes: token.scope ?? LINKEDIN_SCOPES,
        expires_at: new Date(now.getTime() + (token.expires_in || 5184000) * 1000).toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'brand_id,network' },
    );
    if (error) throw error;

    // O cartão do LinkedIn em Redes passa a "conectado".
    const { data: account } = await admin.from('social_accounts').select('id').eq('brand_id', brandId).eq('network', 'linkedin').maybeSingle();
    if (account) await admin.from('social_accounts').update({ status: 'connected', updated_at: now.toISOString() }).eq('id', account.id);
    else await admin.from('social_accounts').insert({ user_id: user.id, brand_id: brandId, network: 'linkedin', handle: me.name ?? 'perfil', status: 'connected' });

    // Posts que travaram esperando a reconexão voltam para a fila.
    await requeueAfterReconnect(admin, brandId, 'LinkedIn').catch((err) => console.error('[requeue linkedin]', err));
    return back('conectado');
  } catch (err) {
    console.error('[linkedin callback]', err);
    return back('erro');
  }
}
