import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;
const clean = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : null);

// POST /api/visita — conta uma visualização de página pública (para o gráfico de visitas do /painel).
export async function POST(request: Request) {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return new NextResponse(null, { status: 204 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const path = clean(body.path, 200);
    if (!path || path.startsWith('/app') || path.startsWith('/painel') || path.startsWith('/api')) return new NextResponse(null, { status: 204 });

    const jar = await cookies();
    let visitor = jar.get('vid')?.value;
    const isNew = !visitor;
    if (!visitor) visitor = crypto.randomUUID();

    await createAdminClient()
      .from('site_visits')
      .insert({ visitor, path, source: clean(body.source, 80), medium: clean(body.medium, 80) });

    const res = new NextResponse(null, { status: 204 });
    if (isNew) res.cookies.set('vid', visitor, { path: '/', maxAge: 365 * 86400, sameSite: 'lax', secure: true, httpOnly: true });
    return res;
  } catch {
    return new NextResponse(null, { status: 204 }); // contagem nunca quebra a página
  }
}
