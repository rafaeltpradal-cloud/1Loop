import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorizeUrl, linkedinConfigured } from '@/lib/linkedin';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';

// GET /api/linkedin/conectar → manda a pessoa autorizar o 1loop no LinkedIn.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${siteUrl()}/entrar?next=/app/redes`);
  if (!linkedinConfigured()) return NextResponse.redirect(`${siteUrl()}/app/redes?linkedin=indisponivel`);

  const state = randomBytes(18).toString('base64url');
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set('li_state', state, { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/linkedin', maxAge: 600 });
  return res;
}
