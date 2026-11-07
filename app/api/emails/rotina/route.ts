import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isOwner } from '@/lib/owner';
import { sendEmail } from '@/lib/email';
import { monthlyEmail, runRoutine, weeklyEmail } from '@/lib/routine';
import { runDaily, todayEmail } from '@/lib/daily';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET pelo cron da Vercel, todo dia às 8h de Brasília: na segunda sai o resumo da semana, no dia 1 o do mês.
// Dono logado: ?amostra=semana|mes mostra o e-mail com os dados dele (&enviar=1 manda para ele); ?previa=semana|mes lista quem receberia.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const amostra = url.searchParams.get('amostra');
  const previa = url.searchParams.get('previa');
  if (amostra || previa) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isOwner(user.email)) return new NextResponse('Não encontrado', { status: 404 });
    if (previa === 'semana' || previa === 'mes') return NextResponse.json(await runRoutine({ dryRun: true, force: previa }));
    // ?previa=dia: quem recebe hoje o lembrete do post do dia / aviso de conexão vencendo.
    if (previa === 'dia') return NextResponse.json(await runDaily({ dryRun: true }));
    const admin = createAdminClient();
    const first = ((user.user_metadata?.name as string | undefined) || 'Rafael').split(' ')[0];
    const mail = amostra === 'mes' ? await monthlyEmail(admin, user, first) : amostra === 'dia' ? await todayEmail(admin, user, first) : await weeklyEmail(admin, user, first);
    if (!mail) return new NextResponse('Sem dados para este e-mail nesta conta.', { status: 200 });
    if (url.searchParams.get('enviar') === '1' && user.email) {
      const ok = await sendEmail({ to: user.email, ...mail, subject: `[Teste] ${mail.subject}` });
      return NextResponse.json({ ok, para: user.email, assunto: mail.subject });
    }
    return new NextResponse(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  // Só o cron (ou quem tem o segredo) dispara de verdade.
  if (!/vercel-cron/i.test(req.headers.get('user-agent') ?? '') && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse('Não encontrado', { status: 404 });
  const rotina = await runRoutine();
  const diario = await runDaily().catch((err) => {
    console.error('[diário]', err);
    return { erro: true };
  });
  return NextResponse.json({ rotina, diario });
}
