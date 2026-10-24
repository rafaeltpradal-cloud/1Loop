// E-mails para quem criou a conta e ainda não começou o teste (prévia sem cartão).
// Cada um sai uma vez por pessoa; o tom é direto, com uma chamada só.
import { brl } from '@/lib/plans';
import { esc, frame, strip } from '@/lib/emails/trial';

export type RecoveryKind = 'pv1' | 'pv2' | 'pv3' | 'fd1' | 'fd2';

export type RecoveryInput = {
  kind: RecoveryKind;
  firstName: string;
  appUrl: string;
  unsubscribeUrl: string;
  /** Até onde a pessoa chegou na prévia. */
  stage: { answered: number; total: number; interviewDone: boolean; hasStrategy: boolean; posts: number; firstPostId: number | null };
  plan: { name: string; full: number; now: number };
  founders: { open: boolean; daysLeft: number; label: string };
};

export function recoveryEmail(p: RecoveryInput) {
  const n = esc(p.firstName);
  const founders = p.founders.open && p.plan.now < p.plan.full;
  const save = p.plan.full - p.plan.now;
  const app = p.appUrl;
  const continueUrl = p.stage.posts > 0 && p.stage.firstPostId ? `${app}/app/conteudos/${p.stage.firstPostId}` : p.stage.hasStrategy ? `${app}/app/conteudos` : `${app}/app/entrevista`;
  const startUrl = `${app}/app/assinar`;
  const deadline = p.founders.daysLeft <= 0 ? 'hoje às 23h59' : p.founders.daysLeft === 1 ? 'amanhã às 23h59' : `em ${p.founders.daysLeft} dias (${p.founders.label})`;

  // Frase sobre onde a pessoa parou.
  const where = !p.stage.interviewDone
    ? p.stage.answered > 0
      ? `Você parou na pergunta <b>${p.stage.answered + 1} de ${p.stage.total}</b> da entrevista. Faltam uns 5 minutos para a sua estratégia de 30 dias ficar pronta.`
      : 'Sua conta está criada, mas a entrevista ainda não começou. São uns 10 minutos e dela sai a sua estratégia de 30 dias, feita para você.'
    : p.stage.posts > 0
      ? `Sua estratégia de 30 dias e ${p.stage.posts === 1 ? 'seu primeiro post estão prontos' : `seus ${p.stage.posts} primeiros posts estão prontos`}. Escritos na sua voz, a partir da sua entrevista. Só falta você.`
      : 'Sua estratégia de 30 dias está pronta. Com um clique sai o primeiro post, escrito na sua voz.';

  const foundersLine = founders
    ? `E tem um detalhe: o preço Founders acaba <b>${deadline}</b>. Entrando agora, o ${esc(p.plan.name)} sai por <b>${brl(p.plan.now)}/mês</b> em vez de ${brl(p.plan.full)}, travado enquanto você for assinante. São ${brl(save * 12)} a menos por ano.`
    : '';
  const trialLine = 'Começando agora você tem <b>7 dias grátis</b>: nada é cobrado antes do fim do teste e dá para cancelar em 1 clique.';

  let subject = '';
  let title = '';
  let paragraphs: string[] = [];
  let cta = { label: '', href: '' };

  switch (p.kind) {
    case 'pv1':
      subject = !p.stage.interviewDone ? `${p.firstName}, você quase concluiu` : `${p.firstName}, seu post está pronto (e ninguém viu ainda)`;
      title = !p.stage.interviewDone ? 'Você está a 5 minutos da sua estratégia' : 'Seu primeiro post está esperando você';
      paragraphs = [`Oi, ${n}.`, where, founders ? foundersLine : trialLine];
      cta = { label: !p.stage.interviewDone ? 'Continuar de onde parei' : 'Ver meu post', href: continueUrl };
      break;
    case 'pv2':
      subject = founders ? `Você quase concluiu, ${p.firstName}: o preço Founders acaba ${p.founders.daysLeft <= 1 ? deadline : `em ${p.founders.daysLeft} dias`}` : `${p.firstName}, falta 1 passo para o seu LinkedIn andar sozinho`;
      title = founders ? `Garanta ${brl(p.plan.now)}/mês para sempre` : 'Falta 1 passo';
      paragraphs = [
        `${n}, quem vende bem e não aparece no LinkedIn deixa venda na mesa todo dia. O 1loop resolve a parte chata: estratégia, texto, imagem e publicação no horário.`,
        where,
        founders ? foundersLine : '',
        trialLine,
      ].filter(Boolean);
      cta = founders ? { label: 'Garantir meu preço Founders', href: startUrl } : { label: 'Começar meus 7 dias grátis', href: startUrl };
      break;
    case 'pv3':
      subject = `${p.firstName}, seu LinkedIn não vai se escrever sozinho. Ou vai?`;
      title = 'Vai, sim. Se você deixar.';
      paragraphs = [
        `${n}, a ideia do 1loop é simples: você responde uma entrevista uma vez e recebe todo mês uma estratégia e posts prontos na sua voz, publicados no LinkedIn no melhor horário.`,
        'Sem ficar olhando para a tela em branco. Sem sumir por semanas e voltar do zero.',
        where,
        founders ? foundersLine : trialLine,
      ];
      cta = { label: p.stage.interviewDone ? 'Começar meus 7 dias grátis' : 'Terminar minha entrevista', href: p.stage.interviewDone ? startUrl : continueUrl };
      break;
    case 'fd1':
      subject = `Amanhã acaba: ${brl(p.plan.now)}/mês no ${p.plan.name} só até 31/10`;
      title = 'O preço Founders acaba amanhã';
      paragraphs = [
        `${n}, um aviso rápido: amanhã, ${p.founders.label}, o preço Founders sai do ar.`,
        `Quem entra até lá paga <b>${brl(p.plan.now)}/mês</b> no ${esc(p.plan.name)}, travado para sempre. Depois, o mesmo plano custa ${brl(p.plan.full)}.`,
        where,
        trialLine,
      ];
      cta = { label: 'Garantir meu preço Founders', href: startUrl };
      break;
    case 'fd2':
      subject = `Últimas horas, ${p.firstName}: o Founders acaba hoje às 23h59`;
      title = 'Acaba hoje às 23h59';
      paragraphs = [
        `${n}, é hoje. À meia-noite o preço Founders deixa de existir.`,
        `<b>${brl(p.plan.now)}/mês</b> em vez de ${brl(p.plan.full)}, travado enquanto você for assinante. E os 7 dias de teste continuam grátis: você só paga se ficar.`,
        where,
      ];
      cta = { label: `Garantir ${brl(p.plan.now)}/mês agora`, href: startUrl };
      break;
  }

  const footer = `Dúvidas? É só responder este e-mail.<br><br><span style="font-size:12px;color:#6E747D">Você recebe este e-mail porque criou uma conta no 1loop creators. <a href="${p.unsubscribeUrl}" style="color:#6E747D">Não quero mais receber estes lembretes</a>.</span>`;
  return {
    subject,
    html: frame({ appUrl: app, title, paragraphs, cta, footer }),
    text: `${title}\n\n${paragraphs.map(strip).join('\n\n')}\n\n${cta.label}: ${cta.href}\n\nNão quer mais receber estes lembretes? ${p.unsubscribeUrl}`,
  };
}
