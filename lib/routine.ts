// E-mails de rotina para quem assina:
// - Segunda (8h de Brasília): "seus posts da semana", com aprovar em 1 clique cada rascunho.
// - Dia 1 do mês: "seu mês no 1loop", com o que foi gerado, publicado e o alcance do Instagram.
// Cada um sai uma vez por pessoa por semana/mês (registro em app_metadata.routine) e respeita o "não quero mais receber".
import { createHmac } from 'crypto';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { esc, frame, strip } from '@/lib/emails/trial';
import { siteUrl } from '@/lib/stripe';
import { unsubscribeUrl } from '@/lib/recovery';
import { addDays, fromISO, isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { ACTIVE_STATUSES } from '@/lib/billing';
import type { Strategy } from '@/lib/strategy';

type Admin = ReturnType<typeof createAdminClient>;

function secret() {
  const s = process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('Sem chave para assinar links');
  return s;
}
/** Link de aprovar sem senha no e-mail: só vale para aquele post daquela pessoa. */
export const approveToken = (postId: number, userId: string) => createHmac('sha256', `1loop-aprovar:${secret()}`).update(`${postId}:${userId}`).digest('base64url').slice(0, 32);
export const approveUrl = (postId: number, userId: string) => `${siteUrl()}/api/emails/aprovar?p=${postId}&u=${encodeURIComponent(userId)}&t=${approveToken(postId, userId)}`;

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const weekday = (iso: string) => fromISO(iso).toLocaleDateString('pt-BR', { weekday: 'long' });
const dm = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;

async function subscribers(admin: Admin) {
  const { data: subs } = await admin.from('subscriptions').select('user_id, status, created_at').order('created_at', { ascending: false });
  const latest = new Map<string, string>();
  for (const s of (subs ?? []) as { user_id: string; status: string }[]) if (!latest.has(s.user_id)) latest.set(s.user_id, s.status);
  const ids = [...latest.entries()].filter(([, st]) => ACTIVE_STATUSES.includes(st)).map(([id]) => id);
  const users: User[] = [];
  for (const id of ids) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (data?.user?.email && !data.user.app_metadata?.email_optout) users.push(data.user);
  }
  return users;
}

async function firstNameOf(admin: Admin, u: User) {
  const { data } = await admin.from('profiles').select('name').eq('id', u.id).maybeSingle();
  const name = ((data?.name as string | undefined) || (u.user_metadata?.name as string | undefined) || '').trim();
  return name.split(/\s+/)[0] || 'Oi';
}

type Mail = { subject: string; html: string; text: string };

/** Posts desta semana (segunda a domingo) da marca mais antiga da pessoa. */
export async function weeklyEmail(admin: Admin, u: User, firstName: string, today = isoInBrazil()): Promise<Mail | null> {
  const app = siteUrl();
  const monday = addDays(today, -((fromISO(today).getDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const { data: brand } = await admin.from('brands').select('id').eq('user_id', u.id).order('created_at').order('id').limit(1).maybeSingle();
  if (!brand) return null;
  const { data: st } = await admin.from('strategies').select('id, data, created_at').eq('user_id', u.id).eq('brand_id', brand.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!st) return null;
  const strategy = st.data as Strategy;
  const start = planStartFrom(st.created_at as string);
  const { data: posts } = await admin.from('posts').select('id, item_index, status, tema').eq('strategy_id', st.id).eq('user_id', u.id);
  const byIndex = new Map(((posts ?? []) as { id: number; item_index: number; status: string; tema: string }[]).map((p) => [p.item_index, p]));
  const week = strategy.calendario
    .map((it, i) => ({ it, date: itemDate(it, start), post: byIndex.get(i) }))
    .filter((x) => x.date >= monday && x.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!week.length) return null;

  const drafts = week.filter((w) => w.post?.status === 'rascunho').length;
  const missing = week.filter((w) => !w.post).length;
  const rows = week
    .map(({ it, date, post }) => {
      const action = !post
        ? `<a href="${app}/app/conteudos" style="color:#7C4DFF;font-weight:700;text-decoration:none">Gerar</a>`
        : post.status === 'rascunho'
          ? `<a href="${approveUrl(post.id, u.id)}" style="display:inline-block;background:#0E0F12;color:#FFFFFF;font-weight:700;text-decoration:none;padding:7px 14px;border-radius:9px;font-size:13px">Aprovar</a>`
          : `<span style="color:#12A594;font-weight:700">${post.status === 'publicado' ? 'Publicado' : post.status === 'agendado' ? 'Agendado' : 'Aprovado'}</span>`;
      return `<tr><td style="padding:10px 0;border-top:1px solid #EEF0F2;font-size:13px;color:#5E646C;white-space:nowrap;vertical-align:top">${esc(weekday(date))}<br>${dm(date)} · ${esc(it.rede)}</td><td style="padding:10px 12px;border-top:1px solid #EEF0F2;font-size:14px;font-weight:600;color:#0E0F12;vertical-align:top">${esc(post?.tema || it.tema)}</td><td style="padding:10px 0;border-top:1px solid #EEF0F2;text-align:right;vertical-align:top">${action}</td></tr>`;
    })
    .join('');
  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px">${rows}</table>`;
  const lead = drafts
    ? `${esc(firstName)}, ${drafts === 1 ? '1 post desta semana está pronto' : `${drafts} posts desta semana estão prontos`} para você aprovar. Um clique em “Aprovar” e ele abre no app para agendar.`
    : missing
      ? `${esc(firstName)}, ${missing === 1 ? 'falta gerar 1 post' : `faltam ${missing} posts`} desta semana. Leva menos de 1 minuto cada.`
      : `${esc(firstName)}, sua semana já está toda pronta. Dá uma olhada no que vai sair.`;
  const title = `Sua semana no LinkedIn: ${dm(monday)} a ${dm(sunday)}`;
  const paragraphs = [lead, table];
  const cta = { label: missing ? 'Gerar os posts da semana' : 'Abrir meus conteúdos', href: `${app}/app/conteudos` };
  const footer = `Este resumo chega toda segunda às 8h. <a href="${unsubscribeUrl(u.id)}" style="color:#6E747D">Não quero mais receber</a>`;
  return {
    subject: drafts ? `${firstName}, ${drafts} ${drafts === 1 ? 'post pronto' : 'posts prontos'} para aprovar esta semana` : `${firstName}, sua semana no LinkedIn`,
    html: frame({ appUrl: app, title, paragraphs, cta, footer }),
    text: `${title}\n\n${strip(lead)}\n\n${week.map((w) => `${dm(w.date)} · ${w.it.rede} · ${w.post?.tema || w.it.tema}${w.post?.status === 'rascunho' ? ` · Aprovar: ${approveUrl(w.post.id, u.id)}` : ''}`).join('\n')}\n\n${cta.label}: ${cta.href}\n\nNão quer mais receber? ${unsubscribeUrl(u.id)}`,
  };
}

/** Resumo do mês anterior. */
export async function monthlyEmail(admin: Admin, u: User, firstName: string, today = isoInBrazil()): Promise<Mail | null> {
  const app = siteUrl();
  const [y, m] = today.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  const from = `${py}-${String(pm).padStart(2, '0')}-01`;
  const to = `${y}-${String(m).padStart(2, '0')}-01`;
  const fromTs = new Date(`${from}T00:00:00-03:00`).toISOString();
  const toTs = new Date(`${to}T00:00:00-03:00`).toISOString();
  const [{ count: generated }, { data: published }, { data: brands }] = await Promise.all([
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', u.id).gte('created_at', fromTs).lt('created_at', toTs),
    admin.from('posts').select('id, rede').eq('user_id', u.id).eq('status', 'publicado').gte('published_at', fromTs).lt('published_at', toTs),
    admin.from('brands').select('id').eq('user_id', u.id),
  ]);
  const pub = (published ?? []) as { rede: string }[];
  if (!generated && !pub.length) return null;
  let reach = 0;
  let followersNow: number | null = null;
  let followersStart: number | null = null;
  const ids = (brands ?? []).map((b) => b.id as number);
  if (ids.length) {
    const { data: days } = await admin.from('account_metrics').select('day, followers, reach').in('brand_id', ids).gte('day', from).lt('day', to).order('day');
    for (const d of (days ?? []) as { day: string; followers: number | null; reach: number | null }[]) {
      reach += d.reach ?? 0;
      if (d.followers != null) {
        if (followersStart === null) followersStart = d.followers;
        followersNow = d.followers;
      }
    }
  }
  const byNet = pub.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.rede]: (acc[p.rede] ?? 0) + 1 }), {});
  const cell = (n: string, l: string) => `<td style="padding:14px;border:1px solid #EEF0F2;border-radius:12px;text-align:center;width:33%"><div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#0E0F12">${n}</div><div style="font-size:12px;color:#5E646C">${l}</div></td>`;
  const grid = `<table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>${cell(String(pub.length), 'posts publicados')}${cell(String(generated ?? 0), 'posts gerados')}${cell(reach ? reach.toLocaleString('pt-BR') : '—', 'alcance no Instagram')}</tr></table>`;
  const growth = followersNow !== null && followersStart !== null && followersNow !== followersStart ? ` Seguidores no Instagram: ${followersStart} → ${followersNow}.` : '';
  const nets = Object.entries(byNet).map(([k, v]) => `${v} no ${k}`).join(', ');
  const lead = pub.length
    ? `${esc(firstName)}, em ${MONTHS[pm - 1]} você apareceu ${pub.length} ${pub.length === 1 ? 'vez' : 'vezes'} para o seu público${nets ? ` (${esc(nets)})` : ''}.${growth} Quem aparece com constância é quem o cliente lembra primeiro.`
    : `${esc(firstName)}, em ${MONTHS[pm - 1]} você gerou ${generated} ${generated === 1 ? 'post' : 'posts'}, mas nenhum foi publicado ainda. Conecte o LinkedIn e aprove: o 1loop publica no horário certo.`;
  const title = `Seu ${MONTHS[pm - 1]} no 1loop`;
  const cta = { label: `Ver os posts de ${MONTHS[m - 1]}`, href: `${app}/app/conteudos` };
  const footer = `Este resumo chega todo dia 1. <a href="${unsubscribeUrl(u.id)}" style="color:#6E747D">Não quero mais receber</a>`;
  return {
    subject: pub.length ? `${firstName}, seu ${MONTHS[pm - 1]}: ${pub.length} ${pub.length === 1 ? 'post publicado' : 'posts publicados'}` : `${firstName}, seu resumo de ${MONTHS[pm - 1]}`,
    html: frame({ appUrl: app, title, paragraphs: [lead, grid], cta, footer }),
    text: `${title}\n\n${strip(lead)}\n\nPublicados: ${pub.length} · Gerados: ${generated ?? 0} · Alcance no Instagram: ${reach || '—'}\n\n${cta.label}: ${cta.href}\n\nNão quer mais receber? ${unsubscribeUrl(u.id)}`,
  };
}

/** Roda o que vence hoje: segunda → semanal; dia 1 → mensal (os dois, se coincidir). */
export async function runRoutine({ dryRun = false, now = new Date(), force }: { dryRun?: boolean; now?: Date; force?: 'semana' | 'mes' } = {}) {
  const admin = createAdminClient();
  const today = isoInBrazil(now);
  const weekKey = addDays(today, -((fromISO(today).getDay() + 6) % 7));
  const monthKey = today.slice(0, 7);
  const kinds: ('semana' | 'mes')[] = force ? [force] : [...(fromISO(today).getDay() === 1 ? (['semana'] as const) : []), ...(today.endsWith('-01') ? (['mes'] as const) : [])];
  const result = { kinds, sent: 0, skipped: 0, failed: 0, plan: [] as { email: string; kind: string }[] };
  if (!kinds.length) return result;
  for (const u of await subscribers(admin)) {
    const stamp = (u.app_metadata?.routine as { semana?: string; mes?: string } | undefined) ?? {};
    const firstName = await firstNameOf(admin, u);
    for (const kind of kinds) {
      const key = kind === 'semana' ? weekKey : monthKey;
      if (stamp[kind] === key) continue;
      const mail = kind === 'semana' ? await weeklyEmail(admin, u, firstName, today) : await monthlyEmail(admin, u, firstName, today);
      if (!mail) {
        result.skipped++;
        continue;
      }
      if (dryRun) {
        result.plan.push({ email: u.email as string, kind });
        continue;
      }
      const ok = await sendEmail({ to: u.email as string, ...mail, headers: { 'List-Unsubscribe': `<${unsubscribeUrl(u.id)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
      if (!ok) {
        result.failed++;
        continue;
      }
      stamp[kind] = key;
      const { data: fresh } = await admin.auth.admin.getUserById(u.id);
      await admin.auth.admin.updateUserById(u.id, { app_metadata: { ...(fresh?.user?.app_metadata ?? u.app_metadata), routine: { ...stamp } } });
      result.sent++;
    }
  }
  return result;
}
