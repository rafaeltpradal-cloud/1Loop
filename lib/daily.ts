// Lembretes diários (cron da rotina, 8h de Brasília):
// 1) "Seu post de hoje": para quem assina ou já publicou alguma vez, quando o post do dia no calendário
//    ainda não está agendado nem publicado. Um clique leva direto para publicar. Resolve a constância.
// 2) "Sua conexão com o LinkedIn vence": 7 dias antes (o LinkedIn não renova sozinho), para os agendados não pararem.
// Cada um sai no máximo 1 vez por dia/conexão e respeita o "não quero mais receber" e o intervalo de outros e-mails.
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { esc, frame } from '@/lib/emails/trial';
import { siteUrl } from '@/lib/stripe';
import { unsubscribeUrl } from '@/lib/recovery';
import { fromISO, isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { ACTIVE_STATUSES } from '@/lib/billing';
import { marketOf } from '@/lib/market';
import { isOwner } from '@/lib/owner';
import type { Strategy } from '@/lib/strategy';

type Admin = ReturnType<typeof createAdminClient>;
const HOUR = 3600000;

/** Último e-mail de marketing/engajamento que a pessoa recebeu (para não lotar a caixa). */
function lastEmailAt(u: User) {
  const m = u.app_metadata ?? {};
  const vals: unknown[] = [
    ...Object.values((m.nurture as Record<string, unknown>) ?? {}),
    ...Object.values((m.recovery as Record<string, unknown>) ?? {}),
    ...Object.values((m.campaigns as Record<string, unknown>) ?? {}),
  ];
  return Math.max(0, ...vals.map((v) => (typeof v === 'string' && v.includes('T') ? Date.parse(v) : 0)));
}

async function allUsers(admin: Admin) {
  const out: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

const firstName = async (admin: Admin, u: User) => {
  const { data } = await admin.from('profiles').select('name').eq('id', u.id).maybeSingle();
  return (((data?.name as string | undefined) || (u.user_metadata?.name as string | undefined) || '').trim().split(/\s+/)[0]) || 'Oi';
};

/** E-mail do post de hoje (ou null se não há o que lembrar). */
export async function todayEmail(admin: Admin, u: User, name: string, today = isoInBrazil()) {
  const { data: brand } = await admin.from('brands').select('id').eq('user_id', u.id).order('created_at').order('id').limit(1).maybeSingle();
  if (!brand) return null;
  const { data: st } = await admin.from('strategies').select('id, data, created_at').eq('user_id', u.id).eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!st) return null;
  const strategy = st.data as Strategy;
  const start = planStartFrom(st.created_at as string);
  const idx = strategy.calendario.findIndex((it) => itemDate(it, start) === today);
  if (idx < 0) return null;
  const item = strategy.calendario[idx];
  const { data: post } = await admin.from('posts').select('id, status, tema, content').eq('strategy_id', st.id).eq('item_index', idx).eq('user_id', u.id).maybeSingle();
  if (post && ['agendado', 'publicando', 'publicado'].includes(post.status as string)) return null;
  const app = siteUrl();
  const gancho = ((post?.content as { gancho?: string } | null)?.gancho || (post?.tema as string | undefined) || item.tema || '').trim();
  const wd = fromISO(today).toLocaleDateString('pt-BR', { weekday: 'long' });
  const ready = !!post;
  const subject = ready ? `${name}, seu post de hoje está pronto` : `${name}, hoje é dia de post no ${item.rede}`;
  const title = ready ? 'Seu post de hoje está pronto' : `Hoje (${wd}) tem post no seu plano`;
  const cta = ready
    ? { label: post!.status === 'rascunho' ? 'Revisar e publicar' : 'Publicar agora', href: `${app}/app/conteudos/${post!.id}${post!.status === 'rascunho' ? '' : '#publicar'}` }
    : { label: 'Gerar o post de hoje', href: `${app}/app/conteudos` };
  const paragraphs = [
    `${esc(name)}, ${ready ? 'o post de hoje' : 'o tema de hoje'} no ${esc(item.rede)}: <b>“${esc(gancho)}”</b>.`,
    ready
      ? 'Leva 1 minuto: um clique copia o texto, baixa a imagem e abre a rede. Ou conecte o LinkedIn e ele sai sozinho no horário.'
      : 'Em 1 clique o 1loop escreve o post na sua voz, a partir da sua estratégia. Você revisa e publica.',
    '<span style="font-size:13px;color:#6E747D">Constância é o que faz o LinkedIn te mostrar para mais gente.</span>',
  ];
  return {
    subject,
    html: frame({ appUrl: app, title, paragraphs, cta, footer: `Recebe este lembrete nos dias de post do seu plano. <a href="${unsubscribeUrl(u.id)}" style="color:#5E646C">Não quero mais receber</a>` }),
    text: `${title}\n\n“${gancho}”\n\n${cta.label}: ${cta.href}\n\nNão quer mais receber? ${unsubscribeUrl(u.id)}`,
  };
}

function expiryEmail(u: User, name: string, days: number) {
  const app = siteUrl();
  const when = days <= 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
  const title = `Sua conexão com o LinkedIn vence ${when}`;
  const paragraphs = [
    `${esc(name)}, por segurança o LinkedIn pede para renovar a autorização a cada 60 dias. A sua vence <b>${when}</b>.`,
    'Reconecte agora (leva 10 segundos) para os seus posts agendados continuarem saindo sozinhos.',
  ];
  return {
    subject: `${name}, reconecte o LinkedIn para seus posts não pararem`,
    html: frame({ appUrl: app, title, paragraphs, cta: { label: 'Reconectar o LinkedIn', href: `${app}/app/redes` }, footer: `<a href="${unsubscribeUrl(u.id)}" style="color:#5E646C">Não quero mais receber</a>` }),
    text: `${title}\n\nReconecte em ${app}/app/redes`,
  };
}

export async function runDaily({ dryRun = false, now = new Date() } = {}) {
  const admin = createAdminClient();
  const today = isoInBrazil(now);
  const isMonday = fromISO(today).getDay() === 1;
  const [users, { data: subs }, { data: pubs }, { data: conns }] = await Promise.all([
    allUsers(admin),
    admin.from('subscriptions').select('user_id, status, created_at').order('created_at', { ascending: false }),
    admin.from('posts').select('user_id').eq('status', 'publicado').limit(5000),
    admin.from('social_connections').select('user_id, expires_at').eq('network', 'linkedin'),
  ]);
  const subStatus = new Map<string, string>();
  for (const s of (subs ?? []) as { user_id: string; status: string }[]) if (!subStatus.has(s.user_id)) subStatus.set(s.user_id, s.status);
  const published = new Set((pubs ?? []).map((p) => p.user_id as string));
  const expiry = new Map<string, string>();
  for (const c of (conns ?? []) as { user_id: string; expires_at: string }[]) {
    const prev = expiry.get(c.user_id);
    if (!prev || c.expires_at < prev) expiry.set(c.user_id, c.expires_at);
  }
  const result = { today: 0, expiry: 0, plan: [] as { email: string; kind: string }[] };

  for (const u of users) {
    if (!u.email || isOwner(u.email) || u.app_metadata?.email_optout || marketOf(u) === 'pt') continue;
    const stamp = (u.app_metadata?.daily as { hoje?: string; li?: string } | undefined) ?? {};
    const name = await firstName(admin, u);
    const mails: { kind: 'hoje' | 'li'; mail: { subject: string; html: string; text: string }; mark: string }[] = [];

    // Conexão do LinkedIn vencendo nos próximos 7 dias (avisa 1 vez por data de vencimento).
    const exp = expiry.get(u.id);
    if (exp) {
      const days = Math.ceil((Date.parse(exp) - now.getTime()) / (24 * HOUR));
      if (days >= 0 && days <= 7 && stamp.li !== exp.slice(0, 10)) mails.push({ kind: 'li', mail: expiryEmail(u, name, days), mark: exp.slice(0, 10) });
    }

    // Post de hoje: quem assina (ativo) ou quem já publicou alguma vez. Na segunda, o resumo da semana já cobre quem assina.
    const active = ACTIVE_STATUSES.includes(subStatus.get(u.id) ?? '');
    const eligible = active || published.has(u.id);
    const recent = now.getTime() - lastEmailAt(u) < 20 * HOUR;
    if (eligible && stamp.hoje !== today && !recent && !(isMonday && active)) {
      const mail = await todayEmail(admin, u, name, today);
      if (mail) mails.push({ kind: 'hoje', mail, mark: today });
    }

    for (const m of mails) {
      if (dryRun) {
        result.plan.push({ email: u.email, kind: m.kind });
        continue;
      }
      const ok = await sendEmail({ to: u.email, ...m.mail, headers: { 'List-Unsubscribe': `<${unsubscribeUrl(u.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
      if (!ok) continue;
      stamp[m.kind] = m.mark;
      if (m.kind === 'hoje') result.today++;
      else result.expiry++;
    }
    if (!dryRun && mails.length) {
      const { data: fresh } = await admin.auth.admin.getUserById(u.id);
      await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? u.app_metadata), daily: { ...stamp } } });
    }
  }
  return result;
}
