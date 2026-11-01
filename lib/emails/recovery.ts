// E-mails para quem criou a conta e ainda não começou o teste (prévia sem cartão).
// Cada um sai uma vez por pessoa; o tom é direto, com uma chamada só.
import { brl, money } from '@/lib/plans';
import { esc, frame, strip } from '@/lib/emails/trial';

// ext1: aviso de que o Founders foi prorrogado (para quem já tinha recebido o prazo antigo).
// of1: quem chegou ao pagamento enquanto o Stripe estava suspenso (pedido de desculpas + 10% abaixo do Founders no 1º mês).
export type RecoveryKind = 'pv1' | 'pv2' | 'pv3' | 'fd1' | 'fd2' | 'ext1' | 'of1';

export type RecoveryInput = {
  kind: RecoveryKind;
  firstName: string;
  appUrl: string;
  unsubscribeUrl: string;
  /** Até onde a pessoa chegou na prévia. */
  stage: { answered: number; total: number; interviewDone: boolean; hasStrategy: boolean; posts: number; firstPostId: number | null };
  plan: { name: string; full: number; now: number };
  founders: { open: boolean; daysLeft: number; label: string };
  /** Condição especial (of1): preço do 1º mês e plano. */
  offer?: { price: number; plan: string };
};

export function recoveryEmail(p: RecoveryInput) {
  const n = esc(p.firstName);
  const founders = p.founders.open && p.plan.now < p.plan.full;
  const app = p.appUrl;
  const continueUrl = p.stage.posts > 0 && p.stage.firstPostId ? `${app}/app/conteudos/${p.stage.firstPostId}` : p.stage.hasStrategy ? `${app}/app/conteudos` : `${app}/app/entrevista`;
  const startUrl = `${app}/app/assinar`;
  const deadline = p.founders.daysLeft <= 0 ? 'hoje às 23h59' : p.founders.daysLeft === 1 ? 'amanhã às 23h59' : `em ${p.founders.daysLeft} dias (${p.founders.label})`;

  // Onde a pessoa parou, em uma frase.
  const where = !p.stage.interviewDone
    ? p.stage.answered > 0
      ? `Você parou na pergunta <b>${p.stage.answered + 1} de ${p.stage.total}</b>. Faltam uns 5 minutos.`
      : 'Sua entrevista leva uns 10 minutos.'
    : p.stage.posts > 0
      ? 'Sua estratégia e seu primeiro post já estão prontos.'
      : 'Sua estratégia já está pronta.';
  const price = `<b>${brl(p.plan.now)}/mês</b> em vez de ${brl(p.plan.full)}, travado para sempre`;
  const when = p.founders.daysLeft <= 0 ? 'hoje' : p.founders.daysLeft === 1 ? 'amanhã' : `faltam ${p.founders.daysLeft} dias`;
  const offer = founders ? `Preço Founders até ${p.founders.label} (${when}): ${price}.` : '7 dias grátis, cancele em 1 clique.';

  let subject = '';
  let title = '';
  let paragraphs: string[] = [];
  let cta = { label: '', href: '' };

  switch (p.kind) {
    case 'pv1':
      subject = !p.stage.interviewDone ? `${p.firstName}, você quase concluiu` : `${p.firstName}, seu post está pronto (e ninguém viu ainda)`;
      title = !p.stage.interviewDone ? 'Você está a 5 minutos da sua estratégia' : 'Seu primeiro post está esperando você';
      paragraphs = [p.stage.interviewDone ? `${where} Escritos na sua voz, para você ser visto como referência no LinkedIn.` : `${where} Depois sai a sua estratégia para virar referência no LinkedIn.`, offer];
      cta = { label: !p.stage.interviewDone ? 'Continuar de onde parei' : 'Ver meu post', href: continueUrl };
      break;
    case 'pv2':
      subject = founders ? `Você quase concluiu, ${p.firstName}: o Founders acaba ${p.founders.daysLeft <= 1 ? deadline : `em ${p.founders.daysLeft} dias`}` : `${p.firstName}, falta 1 passo para virar referência`;
      title = 'O cliente olha seu LinkedIn antes de responder';
      paragraphs = [
        `${n}, perfil parado é só mais um vendedor. Perfil ativo chega com credibilidade, e a venda fica mais fácil.`,
        offer,
      ];
      cta = { label: founders ? 'Garantir meu preço Founders' : 'Começar 7 dias grátis', href: startUrl };
      break;
    case 'pv3':
      subject = `${p.firstName}, autoridade se constrói toda semana`;
      title = 'Quem aparece com constância vira referência';
      paragraphs = [
        `${n}, você responde a entrevista uma vez. Todo mês recebe estratégia e posts na sua voz, publicados no melhor horário.`,
        `${where} ${offer}`,
      ];
      cta = { label: p.stage.interviewDone ? 'Começar 7 dias grátis' : 'Terminar minha entrevista', href: p.stage.interviewDone ? startUrl : continueUrl };
      break;
    case 'fd1':
      subject = `Amanhã acaba: ${brl(p.plan.now)}/mês no ${p.plan.name}`;
      title = 'O preço Founders acaba amanhã';
      paragraphs = [`${n}, comece sua autoridade no LinkedIn pelo menor preço que o 1loop vai ter: ${price}.`, 'E os 7 dias de teste continuam grátis.'];
      cta = { label: 'Garantir meu preço Founders', href: startUrl };
      break;
    case 'fd2':
      subject = `Últimas horas, ${p.firstName}: o Founders acaba hoje às 23h59`;
      title = 'Acaba hoje às 23h59';
      paragraphs = [`${n}, à meia-noite o preço Founders deixa de existir: ${price}.`, 'Os 7 dias continuam grátis. Você só paga se ficar.'];
      cta = { label: `Garantir ${brl(p.plan.now)}/mês`, href: startUrl };
      break;
    case 'of1': {
      const op = p.offer?.price ?? p.plan.now;
      subject = `${p.firstName}, tivemos um problema no pagamento (e uma condição para você)`;
      title = `${money(op)} no primeiro mês, só para você`;
      paragraphs = [
        `${n}, você chegou à página de pagamento do 1loop nos últimos dias. Nosso processador de pagamentos ficou instável e quem tentou assinar pode não ter conseguido. O problema foi nosso e já está resolvido.`,
        `Para compensar, liberei para você <b>${money(op)}</b> no primeiro mês do ${esc(p.plan.name)}, 10% abaixo do preço Founders. Depois segue no Founders, ${money(p.plan.now)}/mês, travado para sempre. Os 7 dias de teste continuam grátis.`,
        `<span style="font-size:13px;color:#6E747D">Na tela de pagamento aparece o preço Founders; o desconto extra entra sozinho na primeira cobrança. Válido até ${esc(p.founders.label)}.</span>`,
      ];
      cta = { label: `Assinar por ${money(op)} no 1º mês`, href: `${startUrl}?plano=${encodeURIComponent(p.offer?.plan ?? 'pro')}` };
      break;
    }
    case 'ext1':
      subject = `${p.firstName}, prorrogamos o preço Founders até ${p.founders.label.replace(' às 23h59', '')}`;
      title = `O preço Founders vale até ${p.founders.label}`;
      paragraphs = [
        `${n}, você chegou a ver que o preço Founders acabava em 31/10. Como você já começou no 1loop, quis te avisar pessoalmente: ele foi prorrogado até ${p.founders.label}.`,
        `${where} ${price}. Os 7 dias de teste continuam grátis e você cancela em 1 clique.`,
      ];
      cta = { label: 'Garantir meu preço Founders', href: startUrl };
      break;
  }

  const footer = `<span style="font-size:12px;color:#6E747D">Dúvidas? Responda este e-mail. · <a href="${p.unsubscribeUrl}" style="color:#6E747D">Não quero mais receber</a></span>`;
  return {
    subject,
    html: frame({ appUrl: app, title, paragraphs, cta, footer }),
    text: `${title}\n\n${paragraphs.map(strip).join('\n\n')}\n\n${cta.label}: ${cta.href}\n\nNão quer mais receber estes lembretes? ${p.unsubscribeUrl}`,
  };
}
