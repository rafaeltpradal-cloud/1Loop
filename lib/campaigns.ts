// Campanhas pontuais disparadas pelo dono (não entram no cron).
// cr1 (nov/2026): prova real (os números do LinkedIn do Rafael, fundador, que usa a 1loop) + próximo passo
// de acordo com onde a pessoa parou + condição de 10% abaixo do Founders no 1º mês, por tempo curto.
// Vai para contas do Brasil sem assinatura. Cada campanha sai uma vez por pessoa (app_metadata.campaigns).
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { esc, frame } from '@/lib/emails/trial';
import { chosenPlan, freeTrialEnd } from '@/lib/access';
import { activeOffer, offerCoupon, offerPrice, type Offer } from '@/lib/offers';
import { PLANS, money } from '@/lib/plans';
import { priceNow } from '@/lib/founders';
import { QUESTIONS } from '@/lib/interview';
import { isOwner } from '@/lib/owner';
import { siteUrl } from '@/lib/stripe';
import { marketOf } from '@/lib/market';
import { unsubscribeUrl } from '@/lib/recovery';
import { trialGroupOf } from '@/lib/trialGroup';

export type CampaignId = 'cr1';
export const CAMPAIGNS: CampaignId[] = ['cr1'];

/** Prazo da condição da campanha cr1. */
const CR1_UNTIL = '2026-11-10T23:59:59-03:00';
const CR1_UNTIL_LABEL = 'terça (10/11)';

type Stage = { answered: number; total: number; interviewDone: boolean; posts: number; firstPost: { id: number; tema: string } | null; published: number };

function fmtDay(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

export function cr1Email(p: { firstName: string; appUrl: string; unsubscribeUrl: string; stage: Stage; plan: keyof typeof PLANS; trialEnd: Date | null; cardGroup: boolean }) {
  const app = p.appUrl;
  const n = esc(p.firstName);
  const s = p.stage;
  const offerPlan = offerCoupon(p.plan) ? p.plan : 'pro';
  const op = offerPrice(offerPlan);
  const founders = priceNow(offerPlan);

  let step: string;
  let cta: { label: string; href: string };
  if (!s.interviewDone) {
    const left = Math.max(1, s.total - s.answered);
    step = s.answered > 0
      ? `Seu próximo passo é terminar a entrevista: faltam <b>${left} ${left === 1 ? 'pergunta' : 'perguntas'}</b>. Em uns 5 minutos saem sua estratégia e seus primeiros posts, na sua voz.`
      : 'Seu próximo passo é a entrevista: são 5 perguntas rápidas. Em uns 5 minutos saem sua estratégia e seus primeiros posts, na sua voz.';
    cta = { label: s.answered > 0 ? 'Terminar minha entrevista' : 'Começar minha entrevista', href: `${app}/app/entrevista` };
  } else if (!s.firstPost) {
    step = 'Sua estratégia já está pronta. Abra Conteúdos e seus primeiros posts saem sozinhos, em instantes.';
    cta = { label: 'Ver meus posts', href: `${app}/app/conteudos` };
  } else if (!s.published) {
    step = `Seu primeiro post já está pronto: <b>“${esc(s.firstPost.tema)}”</b>. Um clique copia o texto, baixa a imagem e abre o LinkedIn. Ele é o primeiro ponto do seu gráfico.`;
    cta = { label: 'Publicar meu primeiro post', href: `${app}/app/conteudos/${s.firstPost.id}#publicar` };
  } else {
    step = 'Você já publicou: agora é constância. Deixe os próximos posts agendados e o LinkedIn trabalha por você.';
    cta = { label: 'Agendar os próximos', href: `${app}/app/conteudos` };
  }

  const charge = p.cardGroup
    ? 'Você ativa os 7 dias grátis com o cartão e a cobrança só acontece no 8º dia.'
    : p.trialEnd && p.trialEnd.getTime() > Date.now() + 49 * 3600000
      ? `Seu teste grátis continua até ${fmtDay(p.trialEnd)}: assinando agora, a cobrança só acontece no fim dele.`
      : 'A cobrança é mensal, sem fidelidade.';

  const img = (file: string, alt: string) =>
    `<img src="${app}/emails/${file}" width="496" alt="${esc(alt)}" style="display:block;width:100%;max-width:496px;height:auto;border:1px solid #E3E6EA;border-radius:14px">`;

  const subject = `${p.firstName}, 10.813 impressões no LinkedIn (o print está aqui)`;
  const title = 'Do perfil parado a 10 mil impressões';
  const paragraphs = [
    `${n}, quem escreve é o Rafael, fundador da 1loop. Eu uso a ferramenta no meu próprio LinkedIn. Estes são os meus números, direto do painel do LinkedIn:`,
    img('crescimento-impressoes.jpg', 'Impressões no LinkedIn: 10.813 em 90 dias, alta de 984%'),
    img('crescimento-seguidores.jpg', 'Seguidores no LinkedIn: 62 novos em 90 dias'),
    `<b>10.813 impressões</b> em 90 dias (984% a mais que nos 90 dias anteriores) e <b>62 seguidores novos</b>. A curva vira no fim de outubro, quando comecei a postar com a 1loop quase todo dia. Não tem segredo: estratégia certa e constância. A parte difícil (o que postar e como escrever) a ferramenta faz.`,
    step,
    `E para quem começar agora: até ${CR1_UNTIL_LABEL}, <b>${money(op)} no 1º mês</b> do ${esc(PLANS[offerPlan].name)}, 10% abaixo do preço Founders (${money(founders)}). ${charge} Cancele em 1 clique. <a href="${app}/app/assinar?plano=${offerPlan}" style="color:#7C4DFF;font-weight:700">Garantir ${money(op)} no 1º mês →</a>`,
  ];
  const html = frame({
    appUrl: app,
    title,
    paragraphs,
    cta,
    footer: `Qualquer dúvida, é só responder este e-mail: eu leio todos.<br><a href="${p.unsubscribeUrl}" style="color:#5E646C">Não quero mais receber estes e-mails</a>`,
  });
  const text = [
    `${p.firstName}, quem escreve é o Rafael, fundador da 1loop. Eu uso a ferramenta no meu próprio LinkedIn.`,
    '10.813 impressões em 90 dias (984% a mais que nos 90 dias anteriores) e 62 seguidores novos. A curva vira no fim de outubro, quando comecei a postar com a 1loop quase todo dia.',
    step.replace(/<[^>]+>/g, ''),
    `${cta.label}: ${cta.href}`,
    `Até ${CR1_UNTIL_LABEL}: ${money(op)} no 1º mês do ${PLANS[offerPlan].name} (10% abaixo do Founders). ${charge} ${app}/app/assinar?plano=${offerPlan}`,
    `Sair da lista: ${p.unsubscribeUrl}`,
  ].join('\n\n');
  return { subject, html, text };
}

async function allUsers() {
  const admin = createAdminClient();
  const out: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

async function stageOf(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<Stage> {
  const [{ data: interview }, { data: posts }] = await Promise.all([
    admin.from('interviews').select('answers, completed_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('posts').select('id, tema, status, item_index').eq('user_id', userId).neq('source', 'demo').order('item_index').limit(50),
  ]);
  const answered = interview?.answers ? Object.keys(interview.answers as object).filter((k) => QUESTIONS.some((q) => q.id === k)).length : 0;
  const list = (posts ?? []) as { id: number; tema: string; status: string }[];
  const firstOpen = list.find((x) => x.status !== 'publicado') ?? list[0] ?? null;
  return {
    answered,
    total: QUESTIONS.length,
    interviewDone: !!interview?.completed_at || answered >= QUESTIONS.length,
    posts: list.length,
    firstPost: firstOpen ? { id: firstOpen.id, tema: firstOpen.tema } : null,
    published: list.filter((x) => x.status === 'publicado').length,
  };
}

/** Lista (dryRun) ou envia a campanha. Libera a condição de 10% na conta de quem recebe. */
export async function runCampaign(id: CampaignId, { dryRun = true } = {}) {
  const admin = createAdminClient();
  const [users, { data: subs }] = await Promise.all([allUsers(), admin.from('subscriptions').select('user_id')]);
  const subscribed = new Set((subs ?? []).map((s) => s.user_id as string));
  const result = { candidates: 0, sent: 0, failed: 0, plan: [] as { email: string; etapa: string }[] };
  const now = new Date();

  for (const u of users) {
    if (!u.email || subscribed.has(u.id) || isOwner(u.email)) continue;
    if (u.app_metadata?.email_optout || marketOf(u) === 'pt') continue;
    const done = (u.app_metadata?.campaigns as Record<string, string> | undefined) ?? {};
    if (done[id]) continue;
    result.candidates++;
    const stage = await stageOf(admin, u.id);
    const etapa = !stage.interviewDone ? 'entrevista' : !stage.firstPost ? 'sem_post' : !stage.published ? 'nao_publicou' : 'publicou';
    if (dryRun) {
      result.plan.push({ email: u.email, etapa });
      continue;
    }
    const { data: profile } = await admin.from('profiles').select('name').eq('id', u.id).maybeSingle();
    const name = ((profile?.name as string | undefined) || (u.user_metadata?.name as string | undefined) || '').trim();
    const cardGroup = trialGroupOf(u) === 'cartao';
    const mail = cr1Email({
      firstName: name.split(/\s+/)[0] || 'Oi',
      appUrl: siteUrl(),
      unsubscribeUrl: unsubscribeUrl(u.id),
      stage,
      plan: chosenPlan(u),
      trialEnd: cardGroup ? null : freeTrialEnd(u),
      cardGroup,
    });
    const ok = await sendEmail({ to: u.email, ...mail, headers: { 'List-Unsubscribe': `<${unsubscribeUrl(u.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
    if (!ok) {
      result.failed++;
      continue;
    }
    // Condição de 10% no 1º mês (aplicada pelo webhook na assinatura), se a conta ainda não tem uma.
    const current = u.app_metadata?.offer as Offer | undefined;
    const offer: Offer | undefined = activeOffer(u, now) || current?.used ? undefined : { id: 'founders10', until: new Date(CR1_UNTIL).toISOString() };
    await admin.auth.admin.updateUserById(u.id, {
      app_metadata: { ...u.app_metadata, campaigns: { ...done, [id]: now.toISOString() }, ...(offer ? { offer } : {}) },
    });
    result.sent++;
  }
  return result;
}

/** Exemplo para o dono conferir. */
export function sampleCampaign(etapa = 'nao_publicou') {
  const stage: Stage =
    etapa === 'entrevista'
      ? { answered: 4, total: QUESTIONS.length, interviewDone: false, posts: 0, firstPost: null, published: 0 }
      : etapa === 'sem_post'
        ? { answered: QUESTIONS.length, total: QUESTIONS.length, interviewDone: true, posts: 0, firstPost: null, published: 0 }
        : { answered: QUESTIONS.length, total: QUESTIONS.length, interviewDone: true, posts: 1, firstPost: { id: 1, tema: 'Seu lead não esfriou. Você parou de chamar.' }, published: 0 };
  return cr1Email({ firstName: 'Rafael', appUrl: siteUrl(), unsubscribeUrl: `${siteUrl()}/api/emails/sair?u=exemplo&t=exemplo`, stage, plan: 'pro', trialEnd: new Date(Date.now() + 5 * 86400000), cardGroup: false });
}
