// Engajamento da base: e-mails pelo que a pessoa FEZ no app (não pelo tempo de conta).
// Teste grátis sem cartão (lib/access.ts): ft0 avisa quem já tinha conta que liberamos 7 dias com tudo;
// a0 puxa quem não chegou ao primeiro post; t1 avisa 2 dias antes do fim do teste; t2 quando acaba.
// Trilha A: gerou post e ainda não publicou nenhum → "você está a um passo de virar referência".
// Trilha B: já publicou → constância (primeiro post no ar, lembrete quando para de aparecer, marco de 5 posts).
// Roda junto com a recuperação (1x por dia, 10h de Brasília), no máximo 1 e-mail por pessoa a cada ~2 dias
// somando todas as trilhas, e respeita o "não quero mais receber". Registro em app_metadata.nurture.
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { esc, frame, strip } from '@/lib/emails/trial';
import { unsubscribeUrl } from '@/lib/recovery';
import { isOwner } from '@/lib/owner';
import { siteUrl } from '@/lib/stripe';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { FREE_TRIAL_LAUNCH, freeTrialEnd } from '@/lib/access';

const HOUR = 3600000;
const DAY = 24 * HOUR;
/** Intervalo mínimo entre quaisquer dois e-mails de marketing para a mesma pessoa. */
const GAP = 44 * HOUR;
/** Lembretes de constância seguidos sem a pessoa publicar: depois disso para até ela voltar. */
const MAX_NUDGES = 4;

export type NurtureKind = 'ft0' | 'a0' | 't1' | 't2' | 'a1' | 'a2' | 'a3' | 'b1' | 'b2' | 'b3';
export const NURTURE_KINDS: NurtureKind[] = ['ft0', 'a0', 't1', 't2', 'a1', 'a2', 'a3', 'b1', 'b2', 'b3'];

/** Situação da conta em relação ao teste grátis e à assinatura. */
export type Account = { createdAt: number; trialEnd: number; subscribed: boolean };

type Sent = Partial<Record<NurtureKind, string>> & { nudges?: number; lastPub?: string };
type PostLite = { id: number; status: string; created_at: string; published_at: string | null };

export type Activity = { posts: PostLite[]; published: PostLite[]; firstDraftId: number | null };

function activityOf(posts: PostLite[]): Activity {
  const sorted = [...posts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const published = sorted.filter((p) => p.status === 'publicado' && p.published_at).sort((a, b) => (a.published_at as string).localeCompare(b.published_at as string));
  const draft = sorted.find((p) => p.status === 'rascunho' || p.status === 'aprovado');
  return { posts: sorted, published, firstDraftId: draft?.id ?? sorted[0]?.id ?? null };
}

const ts = (v?: string | null) => (v ? Date.parse(v) : 0);

/** Qual e-mail de engajamento cabe hoje (no máximo um). */
export function dueNurture(act: Activity, sent: Sent, lastAnyEmail: number, now = Date.now(), acc?: Account): NurtureKind | null {
  if (now - lastAnyEmail < GAP) return null;
  if (acc && !acc.subscribed) {
    const inTrial = acc.trialEnd > now;
    // Quem já tinha conta antes do teste sem cartão: avisa uma vez que está tudo liberado.
    if (inTrial && acc.createdAt < FREE_TRIAL_LAUNCH && !sent.ft0) return 'ft0';
    // Faltam 2 dias ou menos (e ainda dá para assinar sem perder os dias que faltam: o aviso sai com folga).
    if (inTrial && acc.trialEnd - now <= 2.5 * DAY && !sent.t1) return 't1';
    // Acabou há pouco.
    if (!inTrial && now - acc.trialEnd <= 4 * DAY && acc.trialEnd > FREE_TRIAL_LAUNCH && !sent.t2) return 't2';
    // Conta nova que ainda não chegou ao primeiro post.
    if (inTrial && !act.posts.length && acc.createdAt >= FREE_TRIAL_LAUNCH && !sent.a0 && now - acc.createdAt >= 20 * HOUR) return 'a0';
  }
  if (!act.posts.length) return null;

  // Trilha A: tem post e nunca publicou (nem agendou).
  if (!act.published.length) {
    if (act.posts.some((p) => p.status === 'agendado' || p.status === 'publicando')) return null;
    const first = ts(act.posts[0].created_at);
    if (!sent.a1) return now - first >= 18 * HOUR ? 'a1' : null;
    if (!sent.a2) return now - ts(sent.a1) >= 3 * DAY ? 'a2' : null;
    if (!sent.a3) return now - ts(sent.a2) >= 7 * DAY ? 'a3' : null;
    return null;
  }

  // Trilha B: já publicou.
  const firstPub = ts(act.published[0].published_at);
  const lastPub = ts(act.published.at(-1)!.published_at);
  if (!sent.b1) return now - firstPub >= 12 * HOUR ? 'b1' : null;
  if (act.published.length >= 5 && !sent.b3) return 'b3';
  // Constância: 7+ dias sem publicar, no máximo a cada 10 dias, até MAX_NUDGES seguidos (zera quando publica de novo).
  const nudges = sent.lastPub && ts(sent.lastPub) === lastPub ? sent.nudges ?? 0 : 0;
  if (now - lastPub >= 7 * DAY && now - ts(sent.b2) >= 10 * DAY && nudges < MAX_NUDGES) return 'b2';
  return null;
}

export function nurtureEmail(p: { kind: NurtureKind; firstName: string; appUrl: string; unsubscribeUrl: string; act: { posts: number; published: number; firstDraftId: number | null; daysQuiet: number; nudge: number }; trial?: { endLabel: string; daysLeft: number } }) {
  const n = esc(p.firstName);
  const app = p.appUrl;
  const draftUrl = p.act.firstDraftId ? `${app}/app/conteudos/${p.act.firstDraftId}` : `${app}/app/conteudos`;
  const how = 'Abra o post, copie o texto e cole no LinkedIn (ou conecte sua conta e o 1loop publica por você). Depois é só tocar em “Publiquei”.';
  let subject = '';
  let title = '';
  let paragraphs: string[] = [];
  let cta = { label: '', href: '' };

  const endLabel = p.trial?.endLabel ?? '';
  switch (p.kind) {
    case 'ft0':
      subject = `${p.firstName}, liberamos 7 dias do 1loop completo para você (sem cartão)`;
      title = 'Tudo liberado por 7 dias, sem cartão';
      paragraphs = [
        `${n}, mudamos o teste do 1loop: agora são <b>7 dias com tudo liberado</b>, sem precisar colocar cartão. E a sua conta já está nele, até <b>${esc(endLabel)}</b>.`,
        'Dá para conectar o seu LinkedIn e deixar o 1loop publicar sozinho, gerar os posts da semana, ajustar com a IA e criar posts do zero com a sua foto.',
        'Minha sugestão: conecte o LinkedIn e agende 2 posts para esta semana. Leva 5 minutos e você já começa a aparecer.',
      ];
      cta = { label: 'Entrar e conectar meu LinkedIn', href: `${app}/app/redes` };
      break;
    case 'a0':
      subject = `${p.firstName}, seu primeiro post está a 5 minutos`;
      title = 'Falta pouco para o seu primeiro post';
      paragraphs = [
        `${n}, você criou a conta, mas ainda não chegou ao primeiro post. Termine a entrevista (são perguntas rápidas) e a sua estratégia e os posts da semana saem na sua voz.`,
        'Prefere começar do seu jeito? Em “Crie seu post” você coloca uma foto sua, conta o que quer dizer e a IA escreve a legenda.',
        `Seu teste grátis, com tudo liberado e sem cartão, vai até ${esc(endLabel)}.`,
      ];
      cta = { label: 'Continuar de onde parei', href: `${app}/app` };
      break;
    case 't1':
      subject = `${p.firstName}, seu teste grátis acaba ${p.trial && p.trial.daysLeft <= 1 ? 'amanhã' : `em ${p.trial?.daysLeft ?? 2} dias`}`;
      title = `Seu teste vai até ${endLabel}`;
      paragraphs = [
        p.act.published
          ? `${n}, você já publicou ${p.act.published} ${p.act.published === 1 ? 'post' : 'posts'} com o 1loop. Para não perder o ritmo (e o que já está agendado), garanta o seu plano.`
          : p.act.posts
            ? `${n}, você tem ${p.act.posts} ${p.act.posts === 1 ? 'post pronto' : 'posts prontos'} no 1loop. Publique pelo menos um antes do fim do teste: é aí que o LinkedIn começa a trabalhar por você.`
            : `${n}, ainda dá tempo de ver o 1loop funcionando: termine a entrevista e o primeiro post sai em minutos.`,
        `Se assinar agora, a primeira cobrança só acontece em ${esc(endLabel)}, no fim do teste. Cancele quando quiser.`,
      ];
      cta = { label: 'Garantir meu plano', href: `${app}/app/assinar` };
      break;
    case 't2':
      subject = `${p.firstName}, seu teste acabou (seus posts continuam aqui)`;
      title = 'Seu teste grátis acabou';
      paragraphs = [
        p.act.posts
          ? `${n}, a sua estratégia e ${p.act.posts === 1 ? 'o seu post continuam' : `os seus ${p.act.posts} posts continuam`} no 1loop. Assinando, você volta a gerar a semana, ajustar com a IA e publicar sozinho no horário certo.`
          : `${n}, a sua conta continua no 1loop. Assinando, você recebe a estratégia do mês e os posts na sua voz, publicados no horário certo.`,
        'Quem aparece toda semana é quem o mercado lembra primeiro. Cancele quando quiser.',
      ];
      cta = { label: 'Assinar e voltar a publicar', href: `${app}/app/assinar` };
      break;
    case 'a1':
      subject = `${p.firstName}, você está a um passo de virar referência no LinkedIn`;
      title = 'Você está a um passo de virar referência';
      paragraphs = [
        `${n}, ${p.act.posts > 1 ? `seus ${p.act.posts} posts já estão prontos` : 'seu post já está pronto'}, escrito${p.act.posts > 1 ? 's' : ''} na sua voz. Falta só o passo que faz diferença: publicar.`,
        'Cliente, gestor e recrutador olham o seu LinkedIn antes de responder. Um perfil que aparece com ideias próprias chega na conversa com credibilidade.',
        how,
      ];
      cta = { label: 'Publicar meu primeiro post', href: draftUrl };
      break;
    case 'a2':
      subject = `${p.firstName}, o primeiro post é o mais difícil (e o que mais importa)`;
      title = 'O primeiro post é o mais difícil';
      paragraphs = [
        `${n}, todo mundo que virou referência no LinkedIn passou pelo mesmo ponto: o primeiro post publicado. Depois dele, o segundo sai muito mais fácil.`,
        'Se quiser mudar alguma coisa antes, peça à IA dentro do post (“deixe mais curto”, “mais pessoal”) ou edite direto. Leva menos de um minuto.',
        how,
      ];
      cta = { label: 'Abrir meu post', href: draftUrl };
      break;
    case 'a3':
      subject = `${p.firstName}, seu post ainda está esperando por você`;
      title = 'Seu post ainda está aqui';
      paragraphs = [
        `${n}, o post que você gerou continua pronto. Se algo travou (o texto, o tema, o jeito de publicar), responda este e-mail e me conte: eu te ajudo a colocar o primeiro no ar.`,
        'Também dá para criar do seu jeito: em “Crie seu post”, você coloca uma foto sua e pede à IA a legenda.',
      ];
      cta = { label: 'Ver meu post', href: draftUrl };
      break;
    case 'b1':
      subject = `${p.firstName}, seu primeiro post está no ar. Agora vem a constância`;
      title = 'Primeiro post no ar. Parabéns!';
      paragraphs = [
        `${n}, o passo mais difícil já foi. Agora é o que separa quem posta de quem vira referência: <b>aparecer toda semana</b>.`,
        'Autoridade no LinkedIn não vem de um post que viraliza. Vem de o seu público te ver de novo e de novo, falando do mesmo assunto com propriedade. Duas ou três vezes por semana já mudam a forma como o mercado te enxerga.',
        'Deixe os próximos prontos e agendados: o 1loop publica no horário certo, mesmo nas semanas corridas.',
      ];
      cta = { label: 'Preparar meus próximos posts', href: `${app}/app/conteudos` };
      break;
    case 'b2': {
      const v = p.act.nudge % 3;
      const d = p.act.daysQuiet;
      subject = [
        `${p.firstName}, faz ${d} dias que seu LinkedIn não aparece`,
        `${p.firstName}, constância vale mais que post perfeito`,
        `${p.firstName}, quem aparece é lembrado primeiro`,
      ][v];
      title = ['Seu público sente sua falta', 'Constância vale mais que perfeição', 'Quem aparece é lembrado'][v];
      paragraphs = [
        [
          `${n}, você já publicou ${p.act.published} ${p.act.published === 1 ? 'post' : 'posts'}, e o último foi há ${d} dias. O LinkedIn mostra mais quem posta com frequência, e o seu público também lembra mais.`,
          'Um post esta semana já mantém o ritmo. Tem post pronto esperando no seu calendário.',
        ],
        [
          `${n}, quem vira referência não é quem escreve o post perfeito: é quem não some. Faz ${d} dias desde o seu último post.`,
          'Sem tempo? Conte em 1 minuto algo que aconteceu na sua semana em “Contar uma história” e o post sai na sua voz.',
        ],
        [
          `${n}, quando um cliente ou o seu gestor precisar de alguém que entende do assunto, vai lembrar de quem aparece. Faz ${d} dias que você não posta.`,
          'Agende os próximos de uma vez e deixe o 1loop publicar no horário certo.',
        ],
      ][v];
      cta = { label: ['Publicar esta semana', 'Contar uma história', 'Agendar meus posts'][v], href: v === 1 ? `${app}/app/conteudos/novo` : `${app}/app/conteudos` };
      break;
    }
    case 'b3':
      subject = `${p.firstName}, ${p.act.published} posts publicados. É assim que se vira referência`;
      title = `${p.act.published} posts no ar`;
      paragraphs = [
        `${n}, você já apareceu ${p.act.published} vezes para o seu público. É exatamente assim que se constrói autoridade: repetição, com ideias suas.`,
        'Próximo passo: manter o ritmo e acompanhar o que mais funciona em “Desempenho”, para fazer mais do que dá resultado.',
      ];
      cta = { label: 'Ver meu desempenho', href: `${app}/app/desempenho` };
      break;
  }

  const footer = `<span style="font-size:12px;color:#6E747D">Dúvidas? Responda este e-mail. · <a href="${p.unsubscribeUrl}" style="color:#6E747D">Não quero mais receber</a></span>`;
  return {
    subject,
    html: frame({ appUrl: app, title, paragraphs, cta, footer }),
    text: `${title}\n\n${paragraphs.map(strip).join('\n\n')}\n\n${cta.label}: ${cta.href}\n\nNão quer mais receber estes e-mails? ${p.unsubscribeUrl}`,
  };
}

async function allUsers(admin: ReturnType<typeof createAdminClient>) {
  const out: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

const internal = (email: string) => {
  const e = email.toLowerCase();
  const list = (process.env.INTERNAL_EMAILS || 'magstrategy.com.br').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  return isOwner(e) || list.some((x) => (x.includes('@') ? e === x : e.endsWith(`@${x}`)));
};

export async function runNurture({ dryRun = false, now = new Date() } = {}) {
  const admin = createAdminClient();
  const [users, { data: posts }, { data: subs }, { data: profiles }] = await Promise.all([
    allUsers(admin),
    admin.from('posts').select('id, user_id, status, source, created_at, published_at').neq('source', 'demo').limit(50000),
    admin.from('subscriptions').select('user_id, status, created_at').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ]);
  const byUser = new Map<string, PostLite[]>();
  for (const p of (posts ?? []) as (PostLite & { user_id: string })[]) byUser.set(p.user_id, [...(byUser.get(p.user_id) ?? []), p]);
  const subStatus = new Map<string, string>();
  for (const s of (subs ?? []) as { user_id: string; status: string }[]) if (!subStatus.has(s.user_id)) subStatus.set(s.user_id, s.status);
  const names = new Map(((profiles ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name ?? '']));
  const monday = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now) === 'Mon';

  const result = { sent: 0, failed: 0, plan: [] as { email: string; kind: NurtureKind }[] };
  for (const u of users) {
    if (!u.email || internal(u.email) || u.app_metadata?.email_optout) continue;
    // Segunda é dia do resumo semanal de quem assina: não manda outro por cima.
    if (monday && ACTIVE_STATUSES.includes(subStatus.get(u.id) ?? '')) continue;
    const act = activityOf(byUser.get(u.id) ?? []);
    const sent = ((u.app_metadata?.nurture as Sent | undefined) ?? {}) as Sent;
    const recovery = (u.app_metadata?.recovery as Record<string, string> | undefined) ?? {};
    const lastAny = Math.max(0, ...[...Object.values(recovery), ...NURTURE_KINDS.map((k) => sent[k])].map((v) => (typeof v === 'string' ? ts(v) : 0)));
    const subStat = subStatus.get(u.id);
    const end = freeTrialEnd(u);
    const acc: Account = { createdAt: Date.parse(u.created_at), trialEnd: end.getTime(), subscribed: !!subStat };
    const kind = dueNurture(act, sent, lastAny, now.getTime(), acc);
    if (!kind) continue;

    const lastPubIso = act.published.at(-1)?.published_at ?? null;
    const nudges = lastPubIso && sent.lastPub === lastPubIso ? sent.nudges ?? 0 : 0;
    const firstName = ((names.get(u.id) || (u.user_metadata?.name as string | undefined) || '').trim().split(/\s+/)[0]) || 'Oi';
    const mail = nurtureEmail({
      kind,
      firstName,
      appUrl: siteUrl(),
      unsubscribeUrl: unsubscribeUrl(u.id),
      act: {
        posts: act.posts.length,
        published: act.published.length,
        firstDraftId: act.firstDraftId,
        daysQuiet: lastPubIso ? Math.floor((now.getTime() - ts(lastPubIso)) / DAY) : 0,
        nudge: nudges,
      },
      trial: {
        endLabel: end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }),
        daysLeft: Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY)),
      },
    });
    if (dryRun) {
      result.plan.push({ email: u.email, kind });
      continue;
    }
    const ok = await sendEmail({ to: u.email, ...mail, headers: { 'List-Unsubscribe': `<${unsubscribeUrl(u.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
    if (!ok) {
      result.failed++;
      continue;
    }
    const next: Sent = { ...sent, [kind]: now.toISOString() };
    if (kind === 'b2') Object.assign(next, { lastPub: lastPubIso ?? undefined, nudges: nudges + 1 });
    const { data: fresh } = await admin.auth.admin.getUserById(u.id);
    await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? u.app_metadata), nurture: next } });
    result.sent++;
  }
  return result;
}

/** Exemplo para o dono conferir o texto. */
export function sampleNurture(kind: NurtureKind) {
  return nurtureEmail({
    kind,
    firstName: 'Rafael',
    appUrl: siteUrl(),
    unsubscribeUrl: `${siteUrl()}/api/emails/sair?u=exemplo&t=exemplo`,
    act: { posts: 2, published: kind === 'b3' ? 5 : kind.startsWith('b') ? 2 : 0, firstDraftId: null, daysQuiet: 9, nudge: 0 },
    trial: { endLabel: '12/11', daysLeft: 2 },
  });
}
