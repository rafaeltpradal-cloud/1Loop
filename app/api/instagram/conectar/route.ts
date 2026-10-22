import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeUrl, instagramConfigured } from '@/lib/instagram';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';

// GET /api/instagram/conectar → manda a pessoa autorizar o 1loop no Instagram.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/redes`);
  if (!instagramConfigured()) return NextResponse.redirect(`${siteUrl()}/app/redes?instagram=indisponivel`);

  const state = randomBytes(18).toString('base64url');
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set('ig_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/instagram', maxAge: 600 });
  return res;
}
