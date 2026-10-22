import { NextResponse } from 'next/server';
import { publishDue } from '@/lib/publish';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Chamado pelo agendador do banco a cada 5 minutos. Só publica o que já estava agendado e venceu.
async function run() {
  const results = await publishDue();
  return NextResponse.json({ ok: true, publicados: results.filter((r) => r.ok).length, erros: results.filter((r) => !r.ok).length });
}

export const POST = run;
export const GET = run;
