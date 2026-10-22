import { createAdminClient } from '@/lib/supabase/admin';
import { MIME_BY_EXT, readPublicMediaToken } from '@/lib/publicMedia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/midia/<token>.jpg → entrega a mídia de um post para a rede social baixar (link assinado e temporário).
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const t = readPublicMediaToken(file);
  if (!t) return new Response('Link inválido ou vencido', { status: 404 });

  const admin = createAdminClient();
  const { data } = await admin.storage.from('media').createSignedUrl(t.path, 600);
  if (!data?.signedUrl) return new Response('Não encontrado', { status: 404 });
  const upstream = await fetch(data.signedUrl);
  if (!upstream.ok || !upstream.body) return new Response('Não encontrado', { status: 404 });

  const headers = new Headers({ 'Content-Type': MIME_BY_EXT[t.ext] ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=600' });
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  return new Response(upstream.body, { headers });
}
