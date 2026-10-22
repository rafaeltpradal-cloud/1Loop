import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt } from '@/lib/crypto';
import { exchangeCode, me } from '@/lib/instagram';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';

// GET /api/instagram/callback?code=...&state=... → guarda a conexão e volta para Redes.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(`${siteUrl()}/app/redes?instagram=${status}`);
    res.cookies.set('ig_state', '', { path: '/api/instagram', maxAge: 0 });
    return res;
  };

  if (url.searchParams.get('error')) return back('cancelado');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const expected = jar.get('ig_state')?.value;
  if (!code || !state || !expected || state !== expected) return back('erro');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/redes`);

  try {
    const token = await exchangeCode(code);
    const profile = await me(token.accessToken);
    const igUserId = String(profile.user_id ?? profile.id);
    const accountType = profile.account_type ?? null;
    if (accountType === 'PERSONAL') return back('pessoal');

    const admin = createAdminClient();
    const now = new Date();
    const { error } = await admin.from('social_connections').upsert(
      {
        user_id: user.id,
        network: 'instagram',
        external_id: igUserId,
        name: profile.username ?? profile.name ?? null,
        picture: profile.profile_picture_url ?? null,
        access_token: encrypt(token.accessToken),
        scopes: token.permissions,
        expires_at: new Date(now.getTime() + token.expiresIn * 1000).toISOString(),
        meta: { account_type: accountType, app_user_id: profile.id ? String(profile.id) : null },
        updated_at: now.toISOString(),
      },
      { onConflict: 'user_id,network' },
    );
    if (error) throw error;

    // O cartão do Instagram em Redes passa a "conectado", com o @ da conta.
    const handle = profile.username ?? 'perfil';
    const { data: account } = await admin.from('social_accounts').select('id').eq('user_id', user.id).eq('network', 'instagram').maybeSingle();
    if (account) await admin.from('social_accounts').update({ status: 'connected', handle, updated_at: now.toISOString() }).eq('id', account.id);
    else await admin.from('social_accounts').insert({ user_id: user.id, network: 'instagram', handle, status: 'connected' });

    return back('conectado');
  } catch (err) {
    console.error('[instagram callback]', err);
    return back('erro');
  }
}
