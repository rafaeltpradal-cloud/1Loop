import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/owner';
import { runRecovery, sampleRecovery } from '@/lib/recovery';
import type { RecoveryKind } from '@/lib/emails/recovery';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const KINDS: RecoveryKind[] = ['pv1', 'pv2', 'pv3', 'fd1', 'fd2'];

// GET pelo cron da Vercel (1x por dia, 10h de Brasília) ou POST manual: envia os e-mails que vencem agora.
// Dono logado: ?previa=1 lista quem receberia o quê (sem enviar); ?amostra=pv2[&etapa=parou] mostra o e-mail.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const amostra = url.searchParams.get('amostra') as RecoveryKind | null;
  const previa = url.searchParams.get('previa');
  if (amostra || previa) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isOwner(user.email)) return new NextResponse('Não encontrado', { status: 404 });
    if (amostra && KINDS.includes(amostra)) {
      const mail = sampleRecovery(amostra, url.searchParams.get('etapa') === 'parou' ? 'parou' : 'pronto');
      return new NextResponse(`<!-- ${mail.subject} -->${mail.html.replace('<title>', `<title>${mail.subject} · `)}`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return NextResponse.json(await runRecovery({ dryRun: true }));
  }
  if (!/vercel-cron/i.test(req.headers.get('user-agent') ?? '') && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse('Use POST', { status: 405 });
  return NextResponse.json(await runRecovery());
}

export async function POST() {
  return NextResponse.json(await runRecovery());
}
