import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { TRIAL_GROUP_COOKIE } from '@/lib/trialGroup';

export async function middleware(request: NextRequest) {
  // Teste A/B do cartão: sorteia o grupo na primeira visita à página dos anúncios (/vendedores).
  // Vai no pedido também, para a própria página já mostrar a promessa do grupo.
  let group: string | null = null;
  if (request.nextUrl.pathname === '/vendedores' && !request.cookies.get(TRIAL_GROUP_COOKIE) && process.env.TRIAL_CARD_TEST !== '0') {
    group = Math.random() < 0.5 ? 'c' : 'l';
    request.cookies.set(TRIAL_GROUP_COOKIE, group);
  }
  const response = await updateSession(request);
  if (group) response.cookies.set(TRIAL_GROUP_COOKIE, group, { path: '/', maxAge: 60 * 60 * 24 * 180, sameSite: 'lax' });
  return response;
}

export const config = {
  // Ignora arquivos estáticos e o webhook do Stripe (que não tem sessão).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/publicar|api/midia|api/instagram/meta|api/desempenho/sync|api/mcp|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
