// Painel do dono · aba Usuários: cada conta, em que etapa está e o que está usando.
// Só roda no servidor (service role). Contas da equipe ficam separadas para não inflar os números.
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { QUESTIONS } from '@/lib/interview';
import { chosenPlan } from '@/lib/access';
import type { PlanId } from '@/lib/plans';

export type Stage = 'cadastrou' | 'entrevista' | 'estrategia' | 'post' | 'pagamento' | 'teste' | 'pagante' | 'atrasado' | 'cancelado';

export type OwnerUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  /** Última vez que abriu o app (null enquanto a coluna last_seen_at não existir ou a pessoa não voltou). */
  lastSeen: string | null;
  /** Última coisa que fez de verdade: resposta da entrevista, estratégia, post gerado/editado. */
  lastAction: string | null;
  internal: boolean;
  plan: PlanId;
  origem: { source: string; campaign: string | null; ad: string | null } | null;
  interview: { answered: number; total: number; done: boolean };
  strategies: number;
  posts: { total: number; approved: number; scheduled: number; published: number; errors: number };
  networks: { network: string; expired: boolean }[];
  reachedCheckout: boolean;
  sub: { status: string; plan: PlanId | null; trialEnd: string | null; mrr: number; source: 'stripe' | 'banco' } | null;
  stage: Stage;
  emails: { kind: string; at: string }[];
  offer: boolean;
  optout: boolean;
};

const DAY = 86400000;

// Equipe: dono + e-mails/domínios em INTERNAL_EMAILS (separados por vírgula). Padrão: o domínio da MAG.
function internalMatcher(ownerCheck: (e: string) => boolean) {
  const list = (process.env.INTERNAL_EMAILS || 'magstrategy.com.br')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return (email: string) => {
    const e = email.toLowerCase();
    return ownerCheck(e) || list.some((x) => (x.includes('@') ? e === x : e.endsWith(`@${x}`)));
  };
}

async function allAuthUsers(admin: SupabaseClient) {
  const out: User[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return out;
}

const latest = (...xs: (string | null | undefined)[]) => xs.filter((x): x is string => !!x).sort().at(-1) ?? null;

/** Lê tudo do banco. A situação da assinatura do Stripe entra depois, em applyStripe. */
export async function loadOwnerUsers(admin: SupabaseClient, isOwner: (e: string) => boolean): Promise<OwnerUser[]> {
  const isInternal = internalMatcher(isOwner);
  const [users, profiles, interviews, strategies, posts, conns, subs] = await Promise.all([
    allAuthUsers(admin),
    admin.from('profiles').select('*'),
    admin.from('interviews').select('user_id, answers, completed_at, updated_at'),
    admin.from('strategies').select('user_id, created_at').limit(20000),
    admin.from('posts').select('user_id, status, source, created_at, updated_at, publish_error').limit(50000),
    admin.from('social_connections').select('user_id, network, expires_at'),
    admin.from('subscriptions').select('user_id, status, plan, trial_end, created_at').order('created_at', { ascending: false }),
  ]);

  const prof = new Map(((profiles.data ?? []) as Record<string, unknown>[]).map((p) => [p.id as string, p]));
  const intv = new Map(((interviews.data ?? []) as { user_id: string; answers: Record<string, unknown> | null; completed_at: string | null; updated_at: string }[]).map((i) => [i.user_id, i]));
  const group = <T extends { user_id: string }>(rows: T[] | null) => {
    const m = new Map<string, T[]>();
    for (const r of rows ?? []) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
    return m;
  };
  const strat = group((strategies.data ?? []) as { user_id: string; created_at: string }[]);
  const postBy = group((posts.data ?? []) as { user_id: string; status: string; source: string; created_at: string; updated_at: string; publish_error: string | null }[]);
  const connBy = group((conns.data ?? []) as { user_id: string; network: string; expires_at: string }[]);
  const subBy = new Map<string, { status: string; plan: string | null; trial_end: string | null }>();
  for (const s of (subs.data ?? []) as { user_id: string; status: string; plan: string | null; trial_end: string | null }[]) if (!subBy.has(s.user_id)) subBy.set(s.user_id, s);
  const qIds = new Set(QUESTIONS.map((q) => q.id));

  return users
    .filter((u) => !!u.email)
    .map((u): OwnerUser => {
      const p: Record<string, unknown> = prof.get(u.id) ?? {};
      const i = intv.get(u.id);
      const ps = (postBy.get(u.id) ?? []).filter((x) => x.source !== 'demo');
      const st = strat.get(u.id) ?? [];
      const o = (p.origem as Record<string, string> | null) ?? null;
      const dbSub = subBy.get(u.id);
      const recovery = (u.app_metadata?.recovery as Record<string, string> | undefined) ?? {};
      const answered = i?.answers ? Object.keys(i.answers).filter((k) => qIds.has(k)).length : 0;
      const name = String(p.name || u.user_metadata?.name || '').trim();
      const row: OwnerUser = {
        id: u.id,
        email: u.email as string,
        name,
        phone: (p.phone as string | null) || (u.user_metadata?.phone as string | undefined) || null,
        createdAt: u.created_at,
        lastSeen: (p.last_seen_at as string | null | undefined) ?? null,
        lastAction: latest(i && answered > 0 ? i.updated_at : null, ...st.map((x) => x.created_at), ...ps.map((x) => x.updated_at)),
        internal: isInternal(u.email as string),
        plan: chosenPlan(u),
        origem: o
          ? {
              source: o.ref ? 'indicação' : o.utm_source || (o.referrer ? safeHost(o.referrer) : '') || 'direto',
              campaign: o.utm_campaign || null,
              ad: o.utm_content || null,
            }
          : null,
        interview: { answered, total: QUESTIONS.length, done: !!i?.completed_at },
        strategies: st.length,
        posts: {
          total: ps.length,
          approved: ps.filter((x) => x.status === 'aprovado').length,
          scheduled: ps.filter((x) => x.status === 'agendado' || x.status === 'publicando').length,
          published: ps.filter((x) => x.status === 'publicado').length,
          errors: ps.filter((x) => x.status === 'erro').length,
        },
        networks: (connBy.get(u.id) ?? []).map((c) => ({ network: c.network, expired: Date.parse(c.expires_at) < Date.now() })),
        reachedCheckout: !!p.stripe_customer_id,
        sub: dbSub ? { status: dbSub.status, plan: (dbSub.plan as PlanId | null) ?? null, trialEnd: dbSub.trial_end, mrr: 0, source: 'banco' } : null,
        stage: 'cadastrou',
        emails: Object.entries(recovery)
          .filter(([, at]) => typeof at === 'string')
          .map(([kind, at]) => ({ kind, at }))
          .sort((a, b) => a.at.localeCompare(b.at)),
        offer: !!u.app_metadata?.offer && !(u.app_metadata.offer as { used?: string }).used,
        optout: !!u.app_metadata?.email_optout,
      };
      row.stage = stageOf(row);
      return row;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function stageOf(u: Pick<OwnerUser, 'sub' | 'reachedCheckout' | 'posts' | 'strategies' | 'interview'>): Stage {
  const s = u.sub?.status;
  if (s === 'active') return 'pagante';
  if (s === 'trialing') return 'teste';
  if (s === 'past_due' || s === 'unpaid') return 'atrasado';
  if (s === 'canceled' || s === 'incomplete_expired') return 'cancelado';
  if (u.reachedCheckout) return 'pagamento';
  if (u.posts.total > 0) return 'post';
  if (u.strategies > 0) return 'estrategia';
  if (u.interview.answered > 0) return 'entrevista';
  return 'cadastrou';
}

/**
 * O Stripe (modo real) é a verdade sobre a assinatura. Assinatura que só existe no banco
 * (criada em modo de teste ou liberada à mão) fica marcada como "banco".
 */
export function applyStripe(users: OwnerUser[], byUser: Map<string, { status: string; plan: PlanId | null; trialEnd: string | null; mrr: number }>) {
  for (const u of users) {
    const s = byUser.get(u.id);
    if (s) u.sub = { ...s, source: 'stripe' };
    u.stage = stageOf(u);
  }
  return users;
}

/** Ativo = fez algo ou abriu o app nos últimos 7 dias. */
export const isActive = (u: Pick<OwnerUser, 'lastSeen' | 'lastAction'>, now = Date.now()) => {
  const t = latest(u.lastSeen, u.lastAction);
  return !!t && now - Date.parse(t) < 7 * DAY;
};
