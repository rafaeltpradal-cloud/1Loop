import { NextResponse } from 'next/server';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { siteUrl } from '@/lib/stripe';

export const runtime = 'nodejs';

// Avisos que a Meta manda quando a pessoa remove o app pelo Instagram:
//   POST /api/instagram/meta/desautorizar  (Deauthorize callback URL)
//   POST /api/instagram/meta/exclusao      (Data deletion request URL)
// Os dois chegam com um "signed_request" assinado com a chave secreta do app.

function b64url(s: string) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function parseSignedRequest(signed: string): { user_id?: string | number } | null {
  const secret = process.env.INSTAGRAM_APP_SECRET?.trim();
  const [sig, payload] = signed.split('.', 2);
  if (!secret || !sig || !payload) return null;
  const expected = createHmac('sha256', secret).update(payload).digest();
  const got = b64url(sig);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    return JSON.parse(b64url(payload).toString('utf8'));
  } catch {
    return null;
  }
}

async function removeConnection(igUser: string) {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('social_connections')
    .select('user_id, external_id, meta')
    .eq('network', 'instagram');
  const owners = (rows ?? []).filter(
    (r) => r.external_id === igUser || (r.meta as { app_user_id?: string } | null)?.app_user_id === igUser,
  );
  for (const r of owners) {
    await admin.from('social_connections').delete().eq('user_id', r.user_id).eq('network', 'instagram');
    await admin.from('social_accounts').update({ status: 'pending' }).eq('user_id', r.user_id).eq('network', 'instagram');
    await admin
      .from('posts')
      .update({ status: 'aprovado', scheduled_at: null, platform_ref: null })
      .eq('user_id', r.user_id)
      .eq('rede', 'Instagram')
      .eq('status', 'agendado');
  }
  return owners.length;
}

export async function POST(req: Request, { params }: { params: Promise<{ acao: string }> }) {
  const { acao } = await params;
  if (acao !== 'desautorizar' && acao !== 'exclusao') return NextResponse.json({ error: 'not found' }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const signed = form?.get('signed_request');
  const data = typeof signed === 'string' ? parseSignedRequest(signed) : null;
  if (!data?.user_id) return NextResponse.json({ error: 'invalid signed_request' }, { status: 400 });

  const removed = await removeConnection(String(data.user_id));
  console.log(`[instagram ${acao}] conexões removidas: ${removed}`);

  if (acao === 'desautorizar') return NextResponse.json({ ok: true });
  const code = randomBytes(6).toString('hex');
  return NextResponse.json({ url: `${siteUrl()}/exclusao-de-dados?pedido=${code}`, confirmation_code: code });
}
