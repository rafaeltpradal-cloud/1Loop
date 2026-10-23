import { NextResponse } from 'next/server';
import { syncAll } from '@/lib/metrics';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Chamado pelo agendador do banco uma vez por dia: atualiza os números do Instagram de todas as marcas.
async function run() {
  const results = await syncAll();
  return NextResponse.json({ ok: true, marcas: results.length, falhas: results.filter((r) => !r.ok).length });
}
export const GET = run;
export const POST = run;
