import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/owner';
import { runRecovery, sampleRecovery } from '@/lib/recovery';
import { sendEmail } from '@/lib/email';
import type { RecoveryKind } from '@/lib/emails/recovery';
import { runCampaign, sampleCampaign } from '@/lib/campaigns';
import { NURTURE_KINDS, runNurture, sampleNurture, type NurtureKind } from '@/lib/nurture';

export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const KINDS: RecoveryKind[] = ['pv1', 'pv2', 'pv3', 'fd1', 'fd2', 'ext1', 'of1'];

// GET pelo cron da Vercel (1x por dia, 10h de Brasília) ou POST manual: envia os e-mails que vencem agora
// (recuperação de quem não assinou + engajamento pelo que a pessoa fez: gerou e não postou / já posta).
// Dono logado: ?previa=1 lista quem receberia o quê (sem enviar); ?amostra=pv2[&etapa=parou] ou ?amostra=a1 mostra o e-mail.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const amostra = url.searchParams.get('amostra') as RecoveryKind | null;
  const previa = url.searchParams.get('previa');
  const prorrogacao = url.searchParams.get('prorrogacao');
  const oferta = url.searchParams.get('oferta');
  const aquecer = url.searchParams.get('aquecer');
  const campanha = url.searchParams.get('campanha');
  if (amostra || previa || prorrogacao || oferta || aquecer || campanha) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isOwner(user.email)) return new NextResponse('Não encontrado', { status: 404 });
    // ?amostra=cr1[&etapa=entrevista|sem_post|nao_publicou]: exemplo da campanha.
    if (String(amostra) === 'cr1') {
      const mail = sampleCampaign(url.searchParams.get('etapa') ?? undefined);
      if (url.searchParams.get('enviar') === '1' && user.email) {
        const ok = await sendEmail({ to: user.email, ...mail, subject: `[Teste] ${mail.subject}` });
        return NextResponse.json({ ok, para: user.email, assunto: mail.subject });
      }
      return new NextResponse(mail.html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    // ?campanha=cr1 lista quem recebe a campanha (prova + 10% no 1º mês); com &enviar=1, envia.
    if (campanha === 'cr1') return NextResponse.json(await runCampaign('cr1', { dryRun: url.searchParams.get('enviar') !== '1' }));
    const isNurture = !!amostra && NURTURE_KINDS.includes(amostra as unknown as NurtureKind);
    if (amostra && (KINDS.includes(amostra) || isNurture)) {
      const mail = isNurture ? sampleNurture(amostra as unknown as NurtureKind, url.searchParams.get('etapa') ?? undefined) : sampleRecovery(amostra, url.searchParams.get('etapa') === 'parou' ? 'parou' : 'pronto');
      // &enviar=1 manda o exemplo para o e-mail do dono (para testar os botões na caixa de entrada).
      if (url.searchParams.get('enviar') === '1' && user.email) {
        const ok = await sendEmail({ to: user.email, ...mail, subject: `[Teste] ${mail.subject}` });
        return NextResponse.json({ ok, para: user.email, assunto: mail.subject });
      }
      return new NextResponse(`<!-- ${mail.subject} -->${mail.html.replace('<title>', `<title>${mail.subject} · `)}`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    // ?prorrogacao=1 lista quem recebe o aviso de prorrogação do Founders; com &enviar=1, envia.
    // ?oferta=1 lista quem recebe a condição especial (10% abaixo do Founders); com &enviar=1, envia.
    if (oferta) return NextResponse.json(await runRecovery({ offer: true, dryRun: url.searchParams.get('enviar') !== '1' }));
    // ?aquecer=1: disparo manual dos e-mails de engajamento por etapa, com intervalo mínimo de 24h
    // desde o último e-mail (o automático usa 44h). Lista quem recebe; com &enviar=1, envia.
    if (aquecer) return NextResponse.json(await runNurture({ gapHours: 24, dryRun: url.searchParams.get('enviar') !== '1' }));
    if (prorrogacao) return NextResponse.json(await runRecovery({ ext: true, dryRun: url.searchParams.get('enviar') !== '1' }));
    return NextResponse.json({ recuperacao: await runRecovery({ dryRun: true }), engajamento: await runNurture({ dryRun: true }) });
  }
  if (!/vercel-cron/i.test(req.headers.get('user-agent') ?? '') && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return new NextResponse('Use POST', { status: 405 });
  return NextResponse.json(await runAll());
}

// Disparo manual: só com o segredo do cron ou pelo dono logado (antes qualquer um podia acionar).
export async function POST(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !isOwner(user.email)) return new NextResponse('Não encontrado', { status: 404 });
  }
  return NextResponse.json(await runAll());
}

async function runAll() {
  const recuperacao = await runRecovery();
  const engajamento = await runNurture();
  return { recuperacao, engajamento };
}
