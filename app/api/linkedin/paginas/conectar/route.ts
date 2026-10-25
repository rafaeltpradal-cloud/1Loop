import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pagesAuthorizeUrl, pagesConfigured } from '@/lib/linkedinPages';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';

// GET /api/linkedin/paginas/conectar → autorizar o 1loop a publicar nas páginas que a pessoa administra.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/redes`);
  if (!pagesConfigured()) return NextResponse.redirect(`${siteUrl()}/app/redes?linkedin=indisponivel`);
  const state = randomBytes(18).toString('base64url');
  const res = NextResponse.redirect(pagesAuthorizeUrl(state));
  res.cookies.set('li_pg_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/linkedin', maxAge: 600 });
  return res;
}
