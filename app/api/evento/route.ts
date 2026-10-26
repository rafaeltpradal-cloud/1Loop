import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;
const EVENTS = new Set(['cta', 'scroll50', 'scroll90', 'plano']);
const clean = (v: unknown, max = 80) => (typeof v === 'string' ? v.slice(0, max) : null);

// POST /api/evento — clique em botão ou rolagem na landing (sem dado pessoal; usa o mesmo id anônimo da visita).
export async function POST(request: Request) {
  try {
    const ua = request.headers.get('user-agent') ?? '';
    if (!ua || BOT.test(ua)) return new NextResponse(null, { status: 204 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const event = clean(body.event, 20);
    const path = clean(body.path, 200);
    const visitor = (await cookies()).get('vid')?.value;
    if (!event || !EVENTS.has(event) || !path || !visitor) return new NextResponse(null, { status: 204 });
    await createAdminClient().from('site_events').insert({ visitor, path, event, detail: clean(body.detail), source: clean(body.source) });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
