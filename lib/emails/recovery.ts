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
      ? `Você parou na pergunta <b>${p.stage.answered + 1} de ${p.stage.total}</b> da entrevista. Faltam uns 5 minutos para a sua estratégia de autoridade de 30 dias ficar pronta.`
      : 'Sua conta está criada, mas a entrevista ainda não começou. São uns 10 minutos e dela sai a sua estratégia de 30 dias para virar referência no que você faz.'
    : p.stage.posts > 0
      ? `Sua estratégia de 30 dias e ${p.stage.posts === 1 ? 'seu primeiro post estão prontos' : `seus ${p.stage.posts} primeiros posts estão prontos`}. Escritos na sua voz, com o que você sabe de verdade. Só falta você aparecer.`
      : 'Sua estratégia de 30 dias está pronta. Com um clique sai o primeiro post, escrito na sua voz, com o que você sabe de verdade.';

  const foundersLine = founders
    ? `E tem um detalhe: o preço Founders acaba <b>${deadline}</b>. Entrando agora, o ${esc(p.plan.name)} sai por <b>${brl(p.plan.now)}/mês</b> em vez de ${brl(p.plan.full)}, travado enquanto você for assinante. São ${brl(save * 12)} a menos por ano.`
    : '';
  const trialLine = 'Começando agora você tem <b>7 dias grátis</b> para ver seu perfil ganhar ritmo: nada é cobrado antes do fim do teste e dá para cancelar em 1 clique.';

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
      subject = founders ? `Você quase concluiu, ${p.firstName}: o preço Founders acaba ${p.founders.daysLeft <= 1 ? deadline : `em ${p.founders.daysLeft} dias`}` : `${p.firstName}, falta 1 passo para virar referência no LinkedIn`;
      title = 'O cliente pesquisa você antes de responder';
      paragraphs = [
        `${n}, antes de aceitar uma reunião, o cliente abre o seu LinkedIn. Se ele encontra um perfil parado, você é só mais um vendedor. Se encontra alguém que ensina, opina e mostra bastidor, você já chega com credibilidade, e a venda fica mais fácil.`,
        'O 1loop cuida da parte difícil: a estratégia, o texto na sua voz, a imagem e a publicação no horário. Você só aprova.',
        where,
        founders ? foundersLine : '',
        trialLine,
      ].filter(Boolean);
      cta = founders ? { label: 'Garantir meu preço Founders', href: startUrl } : { label: 'Começar meus 7 dias grátis', href: startUrl };
      break;
    case 'pv3':
      subject = `${p.firstName}, autoridade não se constrói em um post. Se constrói toda semana.`;
      title = 'Quem aparece com constância vira a referência';
      paragraphs = [
        `${n}, os vendedores que viram referência no LinkedIn não são os que postam mais bonito. São os que aparecem toda semana com o que sabem: o que aprenderam no campo, o que o cliente pergunta, o que funciona.`,
        'O 1loop transforma a sua experiência nisso: você responde a entrevista uma vez e recebe todo mês a estratégia e os posts prontos, na sua voz, publicados no melhor horário. Sem tela em branco e sem sumir por semanas.',
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
        'É o melhor momento para começar a construir a sua autoridade no LinkedIn, pagando o menor preço que o 1loop vai ter.',
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
        'Se você quer ser lembrado como referência no seu mercado (e vender mais por causa disso), este é o dia de começar pagando menos.',
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
