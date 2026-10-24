// Painel do dono: números do negócio, ao vivo, do Stripe e do banco do 1loop.
// Só roda no servidor e só para os e-mails em OWNER_EMAILS.

import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { planFromPriceId, PLANS, type PlanId } from '@/lib/plans';

export const isOwner = (email?: string | null) =>
  !!email &&
  (process.env.OWNER_EMAILS || 'rafaeltpradal@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase());

const DAY = 86400000;
const toBRL = (cents: number) => cents / 100;
const isoDay = (sec: number) => new Date(sec * 1000 - 3 * 3600 * 1000).toISOString().slice(0, 10); // dia em Brasília
const todayIso = () => isoDay(Math.floor(Date.now() / 1000));

export type DayPoint = { day: string; value: number };
export type FeedItem = { at: string; kind: 'assinou' | 'pagou' | 'cancelou' | 'falhou' | 'reembolso' | 'teste'; who: string; detail: string; amount?: number };
export type Customer = { email: string; name: string; plan: PlanId | null; status: string; since: string; mrr: number; trialEnd: string | null; cancelAt: string | null; origem: string | null };
export type Cost = { id: number; name: string; category: string; amount: number; recurrence: 'mensal' | 'unico'; start: string; end: string | null; notes: string | null };

export type OwnerData = {
  live: boolean;
  updatedAt: string;
  error?: string;
  balance: { available: number; pending: number };
  month: { label: string; gross: number; fees: number; refunds: number; net: number };
  lastMonth: { gross: number; net: number };
  mrr: number;
  trialMrr: number;
  counts: { active: number; trialing: number; pastDue: number; canceled30: number; new30: number; byPlan: Record<PlanId, number> };
  churn30: number | null;
  trialConversion: number | null;
  revenueDaily: { day: string; gross: number; net: number }[];
  mrrDaily: DayPoint[];
  payingDaily: DayPoint[];
  feed: FeedItem[];
  customers: Customer[];
  app: { users: number; usersMonth: number; noSubscription: number; strategies: number; postsMonth: number; postsTotal: number; published: number; brands: number; aiCallsMonth: number };
  costs: Cost[];
  costsMonth: number;
  aiCostMonth: number | null; // da API de custos da Anthropic, em R$
  usdBrl: number;
  visits: { daily: { day: string; visitors: number; views: number }[]; visitors30: number; views30: number; today: number; sources: { source: string; visitors: number }[] };
};

async function all<T>(list: (params: { starting_after?: string }) => Promise<Stripe.ApiList<T & { id: string }>>, max = 1000): Promise<T[]> {
  const out: (T & { id: string })[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await list(after ? { starting_after: after } : {});
    out.push(...page.data);
    if (!page.has_more || out.length >= max) break;
    after = page.data[page.data.length - 1].id;
  }
  return out;
}

/** Valor mensal de uma assinatura (preço × quantidade, já com cupom de valor fixo ou percentual). */
function monthlyValue(sub: Stripe.Subscription) {
  let total = 0;
  for (const it of sub.items.data) {
    const p = it.price;
    const unit = p.unit_amount ?? 0;
    const per = p.recurring?.interval === 'year' ? unit / 12 : unit;
    total += per * (it.quantity ?? 1);
  }
  const discounts = ((sub as unknown as { discounts?: (Stripe.Discount | string)[] }).discounts ?? []).filter((d): d is Stripe.Discount => typeof d !== 'string');
  const legacy = (sub as unknown as { discount?: Stripe.Discount | null }).discount;
  for (const d of legacy ? [...discounts, legacy] : discounts) {
    const c = (d as unknown as { coupon?: Stripe.Coupon; source?: { coupon?: Stripe.Coupon } }).coupon ?? (d as unknown as { source?: { coupon?: Stripe.Coupon } }).source?.coupon;
    if (!c) continue;
    if (c.amount_off) total -= c.amount_off;
    else if (c.percent_off) total -= (total * c.percent_off) / 100;
  }
  return Math.max(0, toBRL(total));
}

const planOf = (sub: Stripe.Subscription): PlanId | null => {
  const meta = sub.metadata?.plan;
  if (meta && meta in PLANS) return meta as PlanId;
  return planFromPriceId(sub.items.data[0]?.price?.id);
};

export async function ownerData(): Promise<OwnerData> {
  const admin = createAdminClient();
  const now = Date.now();
  const since90 = Math.floor((now - 90 * DAY) / 1000);
  const [y, m] = todayIso().split('-').map(Number);
  const monthStart = Math.floor(new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00-03:00`).getTime() / 1000);
  const lmY = m === 1 ? y - 1 : y;
  const lmM = m === 1 ? 12 : m - 1;
  const lastMonthStart = Math.floor(new Date(`${lmY}-${String(lmM).padStart(2, '0')}-01T00:00:00-03:00`).getTime() / 1000);
  const monthLabel = new Date(monthStart * 1000).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });

  // ---------- Banco do 1loop ----------
  const monthIso = new Date(monthStart * 1000).toISOString();
  const [profiles, subsDb, strategies, postsMonth, postsTotal, published, brands, costsRows, settings] = await Promise.all([
    admin.from('profiles').select('id, name, stripe_customer_id, created_at, origem'),
    admin.from('subscriptions').select('user_id'),
    admin.from('strategies').select('id', { count: 'exact', head: true }),
    admin.from('posts').select('versions, content').gte('created_at', monthIso),
    admin.from('posts').select('id', { count: 'exact', head: true }),
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'publicado'),
    admin.from('brands').select('id', { count: 'exact', head: true }),
    admin.from('owner_costs').select('*').order('start_date', { ascending: false }),
    admin.from('owner_settings').select('usd_brl').eq('id', 1).maybeSingle(),
  ]);
  const profs = (profiles.data ?? []) as { id: string; name: string | null; stripe_customer_id: string | null; created_at: string; origem: Record<string, string> | null }[];
  const withSub = new Set(((subsDb.data ?? []) as { user_id: string }[]).map((s) => s.user_id));
  const byCustomer = new Map(profs.filter((p) => p.stripe_customer_id).map((p) => [p.stripe_customer_id as string, p]));
  const strategiesMonth = await admin.from('strategies').select('id', { count: 'exact', head: true }).gte('created_at', monthIso);
  const postRows = (postsMonth.data ?? []) as { versions: number | null; content: { ajustes?: number } | null }[];
  const aiCallsMonth = postRows.reduce((s, p) => s + (p.versions ?? 1) + (p.content?.ajustes ?? 0), 0) + (strategiesMonth.count ?? 0);

  const costs: Cost[] = ((costsRows.data ?? []) as Record<string, unknown>[]).map((c) => ({
    id: c.id as number,
    name: c.name as string,
    category: (c.category as string) ?? 'Outros',
    amount: Number(c.amount_brl) || 0,
    recurrence: c.recurrence === 'unico' ? 'unico' : 'mensal',
    start: c.start_date as string,
    end: (c.end_date as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
  }));
  const monthStartIso = new Date(monthStart * 1000).toISOString().slice(0, 10);
  const nextMonthIso = new Date(new Date(`${y}-${String(m).padStart(2, '0')}-01T12:00:00-03:00`).getTime() + 32 * DAY).toISOString().slice(0, 8) + '01';
  const costsMonth = costs.reduce((sum, c) => {
    if (c.recurrence === 'mensal') return c.start < nextMonthIso && (!c.end || c.end >= monthStartIso) ? sum + c.amount : sum;
    return c.start >= monthStartIso && c.start < nextMonthIso ? sum + c.amount : sum;
  }, 0);
  const usdBrl = Number((settings.data as { usd_brl?: number } | null)?.usd_brl) || 5.4;

  const app = {
    users: profs.length,
    usersMonth: profs.filter((p) => p.created_at >= monthIso).length,
    noSubscription: profs.filter((p) => !withSub.has(p.id)).length,
    strategies: strategies.count ?? 0,
    postsMonth: postRows.length,
    postsTotal: postsTotal.count ?? 0,
    published: published.count ?? 0,
    brands: brands.count ?? 0,
    aiCallsMonth,
  };

  // ---------- Visitas ao site (tabela site_visits) ----------
  const from30 = isoDay(Math.floor((now - 29 * DAY) / 1000));
  const visitRows = (((await admin.from('site_visits').select('day, visitor, source').gte('day', from30).limit(50000)).data ?? []) as { day: string; visitor: string; source: string | null }[]);
  const perDay = new Map<string, { v: Set<string>; n: number }>();
  const perSource = new Map<string, Set<string>>();
  for (const r of visitRows) {
    const d = perDay.get(r.day) ?? { v: new Set<string>(), n: 0 };
    d.v.add(r.visitor);
    d.n += 1;
    perDay.set(r.day, d);
    const src = (r.source || 'direto').toLowerCase();
    const set = perSource.get(src) ?? new Set<string>();
    set.add(r.visitor);
    perSource.set(src, set);
  }
  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = isoDay(Math.floor((now - (29 - i) * DAY) / 1000));
    const d = perDay.get(day);
    return { day, visitors: d ? d.v.size : 0, views: d ? d.n : 0 };
  });
  const visits = {
    daily,
    visitors30: new Set(visitRows.map((r) => r.visitor)).size,
    views30: visitRows.length,
    today: daily.at(-1)?.visitors ?? 0,
    sources: [...perSource.entries()].map(([source, set]) => ({ source, visitors: set.size })).sort((a, b) => b.visitors - a.visitors).slice(0, 6),
  };

  const empty: OwnerData = {
    live: false,
    updatedAt: new Date().toISOString(),
    balance: { available: 0, pending: 0 },
    month: { label: monthLabel, gross: 0, fees: 0, refunds: 0, net: 0 },
    lastMonth: { gross: 0, net: 0 },
    mrr: 0,
    trialMrr: 0,
    counts: { active: 0, trialing: 0, pastDue: 0, canceled30: 0, new30: 0, byPlan: { basic: 0, pro: 0, multi: 0 } },
    churn30: null,
    trialConversion: null,
    revenueDaily: [],
    mrrDaily: [],
    payingDaily: [],
    feed: [],
    customers: [],
    app,
    costs,
    costsMonth,
    aiCostMonth: null,
    usdBrl,
    visits,
  };

  // ---------- Custo da IA (API de custos da Anthropic, se a chave de admin existir) ----------
  let aiCostMonth: number | null = null;
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY?.trim();
  if (adminKey) {
    try {
      const q = new URLSearchParams({ starting_at: new Date(monthStart * 1000).toISOString(), bucket_width: '1d', limit: '31' });
      const r = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, {
        headers: { 'x-api-key': adminKey, 'anthropic-version': '2023-06-01' },
        cache: 'no-store',
      });
      if (r.ok) {
        const j = (await r.json()) as { data?: { results?: { amount?: string | number }[] }[] };
        const usdCents = (j.data ?? []).flatMap((b) => b.results ?? []).reduce((s, x) => s + Number(x.amount ?? 0), 0);
        aiCostMonth = (usdCents / 100) * usdBrl;
      }
    } catch {
      aiCostMonth = null;
    }
  }

  // ---------- Stripe ----------
  let s: Stripe;
  try {
    s = stripe();
  } catch (e) {
    return { ...empty, aiCostMonth, error: e instanceof Error ? e.message : 'Stripe não configurado.' };
  }

  try {
    const [balance, txs, subs, events] = await Promise.all([
      s.balance.retrieve(),
      all<Stripe.BalanceTransaction>((p) => s.balanceTransactions.list({ created: { gte: since90 }, limit: 100, ...p }), 3000),
      all<Stripe.Subscription>((p) => s.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer', 'data.discounts'], ...p }), 2000),
      s.events.list({ limit: 40, types: ['customer.subscription.created', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded', 'customer.subscription.trial_will_end'] }),
    ]);
    const live = balance.livemode;
    const sumBRL = (arr: Stripe.Balance['available']) => toBRL(arr.filter((x) => x.currency === 'brl').reduce((a, b) => a + b.amount, 0));

    // Receita por dia (bruto, taxas, líquido)
    const daily = new Map<string, { gross: number; net: number }>();
    const month = { gross: 0, fees: 0, refunds: 0, net: 0 };
    const lastMonth = { gross: 0, net: 0 };
    for (const t of txs) {
      if (t.currency !== 'brl') continue;
      if (t.type === 'payout' || t.type === 'transfer') continue;
      const d = isoDay(t.created);
      const cur = daily.get(d) ?? { gross: 0, net: 0 };
      const isCharge = t.type === 'charge' || t.type === 'payment';
      const isRefund = t.type === 'refund' || t.type === 'payment_refund';
      if (isCharge) cur.gross += toBRL(t.amount);
      cur.net += toBRL(t.net);
      daily.set(d, cur);
      if (t.created >= monthStart) {
        if (isCharge) month.gross += toBRL(t.amount);
        if (isRefund) month.refunds += toBRL(-t.amount);
        month.fees += toBRL(t.fee);
        month.net += toBRL(t.net);
      } else if (t.created >= lastMonthStart) {
        if (isCharge) lastMonth.gross += toBRL(t.amount);
        lastMonth.net += toBRL(t.net);
      }
    }
    const revenueDaily: OwnerData['revenueDaily'] = [];
    for (let i = 29; i >= 0; i--) {
      const d = isoDay(Math.floor((now - i * DAY) / 1000));
      const v = daily.get(d) ?? { gross: 0, net: 0 };
      revenueDaily.push({ day: d, gross: Math.round(v.gross * 100) / 100, net: Math.round(v.net * 100) / 100 });
    }

    // Assinaturas
    const counts = { active: 0, trialing: 0, pastDue: 0, canceled30: 0, new30: 0, byPlan: { basic: 0, pro: 0, multi: 0 } as Record<PlanId, number> };
    let mrr = 0;
    let trialMrr = 0;
    const cut30 = Math.floor((now - 30 * DAY) / 1000);
    let trialsEnded = 0;
    let trialsConverted = 0;
    const customers: Customer[] = [];
    for (const sub of subs) {
      const value = monthlyValue(sub);
      const plan = planOf(sub);
      if (sub.status === 'active' || sub.status === 'past_due') {
        mrr += value;
        if (plan) counts.byPlan[plan]++;
      }
      if (sub.status === 'active') counts.active++;
      if (sub.status === 'past_due') counts.pastDue++;
      if (sub.status === 'trialing') {
        counts.trialing++;
        trialMrr += value;
        if (plan) counts.byPlan[plan]++;
      }
      if (sub.created >= cut30) counts.new30++;
      if (sub.canceled_at && sub.canceled_at >= cut30) counts.canceled30++;
      if (sub.trial_end && sub.trial_end * 1000 < now && sub.trial_end >= Math.floor((now - 60 * DAY) / 1000)) {
        trialsEnded++;
        if (sub.status === 'active' || sub.status === 'past_due' || (sub.canceled_at && sub.canceled_at > sub.trial_end)) trialsConverted++;
      }
      const cust = typeof sub.customer === 'string' ? null : (sub.customer as Stripe.Customer);
      const prof = byCustomer.get(typeof sub.customer === 'string' ? sub.customer : sub.customer.id);
      const o = prof?.origem;
      customers.push({
        email: (cust && !('deleted' in cust && cust.deleted) ? cust.email : null) ?? '—',
        name: (cust && !('deleted' in cust && cust.deleted) ? cust.name : null) ?? prof?.name ?? '',
        plan,
        status: sub.status,
        since: new Date(sub.created * 1000).toISOString(),
        mrr: value,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
        cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        origem: o ? [o.utm_source, o.utm_campaign].filter(Boolean).join(' · ') || (o.referrer ? new URL(o.referrer).hostname : null) : null,
      });
    }
    customers.sort((a, b) => b.since.localeCompare(a.since));
    const activeStart = counts.active + counts.canceled30 - subs.filter((x) => x.status === 'active' && x.created >= cut30).length;
    const churn30 = activeStart > 0 ? counts.canceled30 / activeStart : null;
    const trialConversion = trialsEnded > 0 ? trialsConverted / trialsEnded : null;

    // MRR e pagantes ao longo de 90 dias (reconstruído das datas de cada assinatura)
    const mrrDaily: DayPoint[] = [];
    const payingDaily: DayPoint[] = [];
    for (let i = 89; i >= 0; i--) {
      const t = Math.floor((now - i * DAY) / 1000);
      let v = 0;
      let n = 0;
      for (const sub of subs) {
        const paidFrom = sub.trial_end ?? sub.created;
        const endedAt = sub.ended_at ?? sub.canceled_at ?? null;
        if (paidFrom <= t && (!endedAt || endedAt > t) && sub.status !== 'incomplete' && sub.status !== 'incomplete_expired') {
          v += monthlyValue(sub);
          n++;
        }
      }
      mrrDaily.push({ day: isoDay(t), value: Math.round(v) });
      payingDaily.push({ day: isoDay(t), value: n });
    }

    // Últimos acontecimentos
    const emailOf = (id: string | null | undefined) => {
      if (!id) return 'cliente';
      const sub = subs.find((x) => (typeof x.customer === 'string' ? x.customer : x.customer.id) === id);
      const c = sub && typeof sub.customer !== 'string' ? (sub.customer as Stripe.Customer) : null;
      return c?.email ?? byCustomer.get(id)?.name ?? 'cliente';
    };
    const feed: FeedItem[] = [];
    for (const ev of events.data) {
      const o = ev.data.object as unknown as Record<string, unknown>;
      const at = new Date(ev.created * 1000).toISOString();
      const cust = (o.customer as string | null) ?? null;
      if (ev.type === 'customer.subscription.created') {
        const sub = o as unknown as Stripe.Subscription;
        feed.push({ at, kind: sub.status === 'trialing' ? 'teste' : 'assinou', who: emailOf(cust), detail: `${PLANS[planOf(sub) ?? 'pro'].name}${sub.status === 'trialing' ? ' · começou o teste de 7 dias' : ''}`, amount: monthlyValue(sub) });
      } else if (ev.type === 'customer.subscription.deleted') {
        feed.push({ at, kind: 'cancelou', who: emailOf(cust), detail: 'assinatura encerrada' });
      } else if (ev.type === 'invoice.paid') {
        const amount = toBRL(Number(o.amount_paid ?? 0));
        if (amount > 0) feed.push({ at, kind: 'pagou', who: emailOf(cust), detail: 'fatura paga', amount });
      } else if (ev.type === 'invoice.payment_failed') {
        feed.push({ at, kind: 'falhou', who: emailOf(cust), detail: 'pagamento recusado', amount: toBRL(Number(o.amount_due ?? 0)) });
      } else if (ev.type === 'charge.refunded') {
        feed.push({ at, kind: 'reembolso', who: emailOf(cust), detail: 'reembolso', amount: toBRL(Number(o.amount_refunded ?? 0)) });
      }
    }

    return {
      ...empty,
      live,
      balance: { available: sumBRL(balance.available), pending: sumBRL(balance.pending) },
      month: { label: monthLabel, ...month },
      lastMonth,
      mrr,
      trialMrr,
      counts,
      churn30,
      trialConversion,
      revenueDaily,
      mrrDaily,
      payingDaily,
      feed: feed.slice(0, 20),
      customers: customers.slice(0, 200),
      aiCostMonth,
    };
  } catch (e) {
    console.error('[painel] stripe', e);
    return { ...empty, aiCostMonth, error: e instanceof Error ? e.message : 'Não deu para ler o Stripe.' };
  }
}
