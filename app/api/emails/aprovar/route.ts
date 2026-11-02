import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { approveToken } from '@/lib/routine';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Aprovar" do e-mail da semana: aprova o rascunho e abre o post no app (para agendar).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const postId = Number(url.searchParams.get('p'));
  const userId = url.searchParams.get('u') ?? '';
  const token = url.searchParams.get('t') ?? '';
  const ok = Number.isInteger(postId) && userId && token.length === 32 && timingSafeEqual(Buffer.from(token), Buffer.from(approveToken(postId, userId)));
  if (!ok) return NextResponse.redirect(`${siteUrl()}/app/conteudos`);
  await createAdminClient()
    .from('posts')
    .update({ status: 'aprovado', updated_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('user_id', userId)
    .eq('status', 'rascunho');
  return NextResponse.redirect(`${siteUrl()}/app/conteudos/${postId}?aprovado=1`);
}
