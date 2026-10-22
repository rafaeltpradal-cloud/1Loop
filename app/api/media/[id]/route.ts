import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/media/:id(?thumb=1) → a imagem da biblioteca, só para o dono. Mesmo domínio, então o canvas pode exportar.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId)) return new Response('Não encontrado', { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Não autenticado', { status: 401 });

  const { data: row } = await supabase.from('media').select('path').eq('id', mediaId).eq('user_id', user.id).maybeSingle();
  if (!row) return new Response('Não encontrado', { status: 404 });

  const thumb = new URL(req.url).searchParams.get('thumb') === '1';
  const path = thumb ? (row.path as string).replace(/\.[a-z0-9]+$/i, '.thumb.jpg') : (row.path as string);
  let { data } = await supabase.storage.from('media').download(path);
  if (!data && thumb && /\.jpe?g$/i.test(row.path as string)) ({ data } = await supabase.storage.from('media').download(row.path as string));
  if (!data) return new Response('Não encontrado', { status: 404 });

  return new Response(data, {
    headers: { 'Content-Type': thumb || /\.jpe?g$/i.test(row.path as string) ? 'image/jpeg' : /\.mov$/i.test(row.path as string) ? 'video/quicktime' : 'video/mp4', 'Cache-Control': 'private, max-age=604800, immutable' },
  });
}
