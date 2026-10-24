'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoopMark } from '@/components/Logo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { LineChart } from '@/components/perf/Charts';
import { PLANS } from '@/lib/plans';
import type { Cost, OwnerData } from '@/lib/owner';
import { deleteCost, saveCost, saveUsdBrl } from './actions';
import { Kpi } from './Kpi';
import { Projections } from './Projections';

const brl = (n: number, cents = true) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1).replace('.', ',')}%`);
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('.', '');
const day = (iso: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00-03:00` : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('.', '');

const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Pagante', cls: 'ok' },
  trialing: { label: 'Em teste', cls: 'trial' },
  past_due: { label: 'Pagamento atrasado', cls: 'warn' },
  canceled: { label: 'Cancelado', cls: 'off' },
  unpaid: { label: 'Não pago', cls: 'warn' },
  incomplete: { label: 'Incompleto', cls: 'off' },
  incomplete_expired: { label: 'Expirado', cls: 'off' },
  paused: { label: 'Pausado', cls: 'off' },
};
const FEED: Record<string, { icon: string; cls: string }> = {
  teste: { icon: '◔', cls: 'trial' },
  assinou: { icon: '＋', cls: 'ok' },
  pagou: { icon: 'R$', cls: 'ok' },
  cancelou: { icon: '×', cls: 'off' },
  falhou: { icon: '!', cls: 'warn' },
  reembolso: { icon: '↺', cls: 'warn' },
};

/** Barras de receita por dia: bruto (claro) e líquido (forte) lado a lado. */
function RevenueBars({ data }: { data: OwnerData['revenueDaily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const pad = { l: 52, r: 8, t: 12, b: 26 };
  const max = Math.max(100, ...data.map((d) => d.gross));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const d = hover !== null ? data[hover] : null;
  return (
    <div className="chartBox ownBars">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Receita por dia nos últimos 30 dias" onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chartGrid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="chartAxis">{t >= 1000 ? `${(t / 1000).toFixed(1).replace('.', ',')} mil` : Math.round(t)}</text>
          </g>
        ))}
        {data.map((p, i) => {
          const x = pad.l + i * bw;
          const w = Math.max(2, Math.min(18, bw * 0.7));
          return (
            <g key={p.day} onPointerEnter={() => setHover(i)}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {p.gross > 0 && <rect x={x + (bw - w) / 2} y={y(p.gross)} width={w} height={y(0) - y(p.gross)} rx="3" className="ownBarGross" />}
              {p.net > 0 && <rect x={x + (bw - w) / 2} y={y(p.net)} width={w} height={y(0) - y(p.net)} rx="3" className="ownBarNet" />}
              {(i % 5 === 0 || i === data.length - 1) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="chartAxis">{`${Number(p.day.slice(8))}/${Number(p.day.slice(5, 7))}`}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="ownBarsInfo" aria-live="polite">
        {d ? (
          <>
            <b>{`${Number(d.day.slice(8))}/${Number(d.day.slice(5, 7))}`}</b> bruto {brl(d.gross)} · líquido {brl(d.net)} · Stripe {brl(Math.max(0, d.gross - d.net))}
          </>
        ) : (
          <>
            <span className="ownDot gross" /> Bruto <span className="ownDot net" /> Líquido (o que fica para você)
          </>
        )}
      </div>
    </div>
  );
}

const EMPTY: Omit<Cost, 'id'> & { id?: number } = { name: '', category: 'Ferramentas', amount: 0, recurrence: 'mensal', start: new Date().toISOString().slice(0, 10), end: null, notes: null };
const CATEGORIES = ['IA', 'Ferramentas', 'Infraestrutura', 'Anúncios', 'Jurídico e contábil', 'Equipe', 'Outros'];

function CostsEditor({ costs, usdBrl }: { costs: Cost[]; usdBrl: number }) {
  const router = useRouter();
  const [form, setForm] = useState<(Omit<Cost, 'id'> & { id?: number }) | null>(null);
  const [err, setErr] = useState('');
  const [rate, setRate] = useState(String(usdBrl).replace('.', ','));
  const [pending, start] = useTransition();

  function submit() {
    if (!form) return;
    start(async () => {
      const r = await saveCost({ ...form, amount: Number(String(form.amount).replace(',', '.')) });
      if (!r.ok) return setErr(r.error ?? 'Erro');
      setForm(null);
      setErr('');
      router.refresh();
    });
  }

  return (
    <section className="card ownSection" aria-labelledby="h-custos">
      <div className="ownSectionHead">
        <h2 id="h-custos">Custos</h2>
        <button type="button" className="btn3d btnSm" onClick={() => setForm({ ...EMPTY })}>Adicionar custo</button>
      </div>
      {form && (
        <form
          className="ownCostForm"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label>Nome<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Claude Max" required /></label>
          <label>Categoria
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Valor (R$)<input className="input" inputMode="decimal" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value as unknown as number })} placeholder="0,00" required /></label>
          <label>Tipo
            <select className="input" value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value as Cost['recurrence'] })}>
              <option value="mensal">Mensal</option>
              <option value="unico">Único</option>
            </select>
          </label>
          <label>{form.recurrence === 'mensal' ? 'Desde' : 'Data'}<input className="input" type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} required /></label>
          {form.recurrence === 'mensal' && <label>Até (opcional)<input className="input" type="date" value={form.end ?? ''} onChange={(e) => setForm({ ...form, end: e.target.value || null })} /></label>}
          <div className="ownCostActions">
            <button type="submit" className="btn3d btnSm" disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" className="linkBtn" onClick={() => (setForm(null), setErr(''))}>Cancelar</button>
            {err && <span role="alert" className="ownErr">{err}</span>}
          </div>
        </form>
      )}
      {costs.length === 0 && !form ? (
        <p className="muted" style={{ fontSize: 13 }}>Nenhum custo lançado. Adicione o que você paga para manter o 1loop: Claude, domínio, Vercel, Supabase, Resend, anúncios.</p>
      ) : (
        <div className="ownTableWrap">
          <table className="ownTable">
            <thead><tr><th>Custo</th><th>Categoria</th><th>Tipo</th><th>Período</th><th className="num">Valor</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td>{c.category}</td>
                  <td>{c.recurrence === 'mensal' ? 'Mensal' : 'Único'}</td>
                  <td>{c.recurrence === 'mensal' ? `desde ${day(c.start)}${c.end ? ` até ${day(c.end)}` : ''}` : day(c.start)}</td>
                  <td className="num">{brl(c.amount)}</td>
                  <td className="ownRowActs">
                    <button type="button" className="linkBtn" onClick={() => setForm({ ...c })}>Editar</button>
                    <button type="button" className="linkBtn" onClick={() => start(async () => { await deleteCost(c.id); router.refresh(); })}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="ownRate">
        <span className="muted">Cotação do dólar usada no custo da API:</span>
        <input className="input" style={{ width: 90 }} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} aria-label="Cotação do dólar" />
        <button type="button" className="linkBtn" onClick={() => start(async () => { await saveUsdBrl(Number(rate.replace(',', '.'))); router.refresh(); })}>Salvar</button>
      </div>
    </section>
  );
}

export function OwnerDashboard({ data }: { data: OwnerData }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<'todos' | 'pagantes' | 'teste' | 'cancelados'>('todos');
  // Aba do painel (Cockpit ou Rumo aos 1.000), lembrada no endereço: /painel?aba=rumo
  const [view, setView] = useState<'agora' | 'rumo'>('agora');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('aba') === 'rumo') setView('rumo');
  }, []);
  const goView = (v: 'agora' | 'rumo') => {
    setView(v);
    const url = new URL(window.location.href);
    if (v === 'rumo') url.searchParams.set('aba', 'rumo');
    else url.searchParams.delete('aba');
    window.history.replaceState(null, '', url.toString());
  };

  // Ao vivo: atualiza sozinho a cada minuto.
  useEffect(() => {
    const t = setInterval(() => startRefresh(() => router.refresh()), 60000);
    return () => clearInterval(t);
  }, [router]);

  const ai = data.aiCostMonth ?? 0;
  const totalCosts = data.costsMonth + ai;
  const profit = data.month.net - totalCosts;
  const growth = data.lastMonth.net > 0 ? (data.month.net - data.lastMonth.net) / data.lastMonth.net : null;
  const arpu = data.counts.active + data.counts.pastDue > 0 ? data.mrr / (data.counts.active + data.counts.pastDue) : 0;
  const customers = useMemo(
    () =>
      data.customers.filter((c) =>
        tab === 'todos' ? true : tab === 'pagantes' ? c.status === 'active' || c.status === 'past_due' : tab === 'teste' ? c.status === 'trialing' : c.status === 'canceled',
      ),
    [data.customers, tab],
  );

  return (
    <div className="owner shell">
      <header className="ownTop">
        <div className="ownBrand">
          <LoopMark size={30} stroke={1.3} />
          <div>
            <b>Painel do dono</b>
            <span className="muted">1loop creators</span>
          </div>
        </div>
        <div className="ownTopRight">
          <span className={data.live ? 'ownMode live' : 'ownMode'}>{data.live ? 'Stripe · modo real' : 'Stripe · modo de teste'}</span>
          <span className="ownUpdated">
            <span className={refreshing ? 'ownPulse busy' : 'ownPulse'} aria-hidden="true" />
            Ao vivo · {new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
          </span>
          <button type="button" className="btnGhost btnSm" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>{refreshing ? 'Atualizando…' : 'Atualizar'}</button>
          <ThemeSwitcher compact />
        </div>
      </header>

      <main className="ownMain">
        <nav className="ownTabs" role="tablist" aria-label="Seções do painel">
          <button type="button" role="tab" aria-selected={view === 'agora'} className={view === 'agora' ? 'ownTab on' : 'ownTab'} onClick={() => goView('agora')}>
            <span className="ownTabDot cyan" aria-hidden="true" />Cockpit<span className="ownTabSub">o negócio hoje</span>
          </button>
          <button type="button" role="tab" aria-selected={view === 'rumo'} className={view === 'rumo' ? 'ownTab on' : 'ownTab'} onClick={() => goView('rumo')}>
            <span className="ownTabDot violet" aria-hidden="true" />Rumo aos 1.000<span className="ownTabSub">projeções e próximos passos</span>
          </button>
        </nav>

        {view === 'rumo' ? (
          <Projections data={data} />
        ) : (
        <>
        {data.error && <div className="formError" role="alert">Stripe: {data.error}</div>}

        <section aria-labelledby="h-mes" className="ownBlock">
          <div className="ownBlockHead">
            <h2 id="h-mes">Dinheiro em {data.month.label}</h2>
            <span className="muted">{growth === null ? 'Primeiro mês com receita' : `${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(0)}% de líquido vs. mês passado`}</span>
          </div>
          <div className="ownKpis five">
            <Kpi label="Faturado (bruto)" value={brl(data.month.gross)} hint={data.month.refunds ? `${brl(data.month.refunds)} reembolsados` : 'tudo que os clientes pagaram'} tone="cyan" />
            <Kpi label="Ficou com o Stripe" value={brl(data.month.fees)} hint={data.month.gross ? `${((data.month.fees / data.month.gross) * 100).toFixed(1).replace('.', ',')}% do bruto` : 'taxas de cartão'} tone="pink" />
            <Kpi label="Ficou para você" value={brl(data.month.net)} hint="líquido, depois das taxas" tone="green" />
            <Kpi label="Custos do mês" value={brl(totalCosts)} hint={data.aiCostMonth !== null ? `inclui ${brl(ai)} de API da Claude` : 'lançados abaixo'} tone="amber" />
            <Kpi label="Lucro" value={brl(profit)} hint={profit >= 0 ? 'líquido − custos' : 'ainda no investimento'} tone={profit >= 0 ? 'green' : 'pink'} />
          </div>
        </section>

        <section aria-labelledby="h-rec" className="ownBlock">
          <div className="ownBlockHead">
            <h2 id="h-rec">Receita recorrente</h2>
            <span className="muted">Saldo no Stripe: {brl(data.balance.available)} disponível · {brl(data.balance.pending)} a receber</span>
          </div>
          <div className="ownKpis five">
            <Kpi label="MRR" value={brl(data.mrr, false)} hint={`${brl(arpu, false)} por pagante`} tone="violet" />
            <Kpi label="Pagantes" value={String(data.counts.active + data.counts.pastDue)} hint={data.counts.pastDue ? `${data.counts.pastDue} com pagamento atrasado` : `Basic ${data.counts.byPlan.basic} · Pro ${data.counts.byPlan.pro} · Multi ${data.counts.byPlan.multi}`} tone="cyan" />
            <Kpi label="Em teste" value={String(data.counts.trialing)} hint={`${brl(data.trialMrr, false)}/mês se todos ficarem`} tone="amber" />
            <Kpi label="Churn (30 dias)" value={pct(data.churn30)} hint={`${data.counts.canceled30} cancelaram · ${data.counts.new30} entraram`} tone="pink" />
            <Kpi label="Teste → pagante" value={pct(data.trialConversion)} hint="testes que viraram assinatura" tone="green" />
          </div>
        </section>

        <div className="ownGrid2">
          <section className="card ownSection" aria-labelledby="h-visitas">
            <div className="ownSectionHead"><h2 id="h-visitas">Visitas ao site</h2><span className="muted">visitantes únicos por dia · 30 dias</span></div>
            <div className="glowGreen"><LineChart points={data.visits.daily.map((d) => ({ day: d.day, value: d.visitors }))} label="Visitantes" color="var(--own-green)" /></div>
          </section>
          <section className="card ownSection" aria-labelledby="h-origem">
            <div className="ownSectionHead"><h2 id="h-origem">De onde vêm</h2><span className="muted">30 dias</span></div>
            <div className="ownMini">
              <div><span className="muted">Hoje</span><b>{data.visits.today}</b></div>
              <div><span className="muted">Visitantes</span><b>{data.visits.visitors30}</b></div>
              <div><span className="muted">Páginas vistas</span><b>{data.visits.views30}</b></div>
              <div><span className="muted">Visita → cadastro</span><b>{data.visits.visitors30 ? `${Math.round((data.app.usersMonth / data.visits.visitors30) * 1000) / 10}%` : '—'}</b></div>
            </div>
            {data.visits.sources.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>A contagem começou agora. As visitas aparecem aqui conforme as pessoas entram no site.</p>
            ) : (
              <ul className="ownSources">
                {data.visits.sources.map((s) => (
                  <li key={s.source}>
                    <span>{s.source}</span>
                    <span className="ownSourceBar" style={{ width: `${Math.max(6, (s.visitors / (data.visits.sources[0]?.visitors || 1)) * 100)}%` }} />
                    <b>{s.visitors}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="ownGrid2">
          <section className="card ownSection" aria-labelledby="h-receita">
            <div className="ownSectionHead"><h2 id="h-receita">Receita por dia</h2><span className="muted">últimos 30 dias</span></div>
            <RevenueBars data={data.revenueDaily} />
          </section>
          <section className="card ownSection" aria-labelledby="h-mrr">
            <div className="ownSectionHead"><h2 id="h-mrr">MRR</h2><span className="muted">últimos 90 dias, em R$</span></div>
            <div className="glowViolet"><LineChart points={data.mrrDaily} label="MRR (R$)" color="var(--own-violet)" /></div>
          </section>
        </div>

        <div className="ownGrid2">
          <section className="card ownSection" aria-labelledby="h-pag">
            <div className="ownSectionHead"><h2 id="h-pag">Pagantes</h2><span className="muted">últimos 90 dias</span></div>
            <div className="glowCyan"><LineChart points={data.payingDaily} label="Pagantes" color="var(--own-cyan)" /></div>
          </section>
          <section className="card ownSection" aria-labelledby="h-feed">
            <div className="ownSectionHead"><h2 id="h-feed">Acontecendo agora</h2><span className="muted">do Stripe</span></div>
            {data.feed.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>Ainda não há movimento no Stripe. Quando alguém assinar, pagar ou cancelar, aparece aqui.</p>
            ) : (
              <ol className="ownFeed">
                {data.feed.map((f, i) => (
                  <li key={i}>
                    <span className={`ownFeedIcon ${FEED[f.kind].cls}`} aria-hidden="true">{FEED[f.kind].icon}</span>
                    <span className="ownFeedText"><b>{f.who}</b><span className="muted">{f.detail}</span></span>
                    <span className="ownFeedRight">{f.amount ? <b>{brl(f.amount)}</b> : null}<span className="muted">{when(f.at)}</span></span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <section className="card ownSection" aria-labelledby="h-cli">
          <div className="ownSectionHead">
            <h2 id="h-cli">Clientes</h2>
            <div className="segmented" role="radiogroup" aria-label="Filtrar clientes">
              {(['todos', 'pagantes', 'teste', 'cancelados'] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tab === t} onClick={() => setTab(t)}>
                  {t === 'todos' ? 'Todos' : t === 'pagantes' ? 'Pagantes' : t === 'teste' ? 'Em teste' : 'Cancelados'}
                </button>
              ))}
            </div>
          </div>
          {customers.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Nenhum cliente aqui ainda.</p>
          ) : (
            <div className="ownTableWrap">
              <table className="ownTable">
                <thead><tr><th>Cliente</th><th>Plano</th><th>Situação</th><th>Desde</th><th>Origem</th><th className="num">Valor/mês</th></tr></thead>
                <tbody>
                  {customers.map((c, i) => (
                    <tr key={i}>
                      <td><b>{c.name || c.email}</b>{c.name && <span className="muted ownSub">{c.email}</span>}</td>
                      <td>{c.plan ? PLANS[c.plan].name : '—'}</td>
                      <td>
                        <span className={`ownStatus ${STATUS[c.status]?.cls ?? 'off'}`}>{STATUS[c.status]?.label ?? c.status}</span>
                        {c.status === 'trialing' && c.trialEnd && <span className="muted ownSub">cobra em {day(c.trialEnd)}</span>}
                        {c.cancelAt && c.status !== 'canceled' && <span className="muted ownSub">cancela em {day(c.cancelAt)}</span>}
                      </td>
                      <td>{day(c.since)}</td>
                      <td>{c.origem ?? <span className="muted">direto</span>}</td>
                      <td className="num">{brl(c.mrr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section aria-labelledby="h-uso" className="ownBlock">
          <div className="ownBlockHead"><h2 id="h-uso">Uso da ferramenta</h2><span className="muted">do banco do 1loop</span></div>
          <div className="ownKpis five">
            <Kpi label="Contas criadas" value={String(data.app.users)} hint={`${data.app.usersMonth} este mês`} />
            <Kpi label="Sem assinatura" value={String(data.app.noSubscription)} hint="cadastraram e não foram ao pagamento" />
            <Kpi label="Posts gerados" value={String(data.app.postsMonth)} hint={`${data.app.postsTotal} no total · ${data.app.published} publicados`} />
            <Kpi label="Chamadas de IA no mês" value={String(data.app.aiCallsMonth)} hint="posts, refações, ajustes e estratégias" />
            <Kpi label="Marcas" value={String(data.app.brands)} hint={`${data.app.strategies} estratégias geradas`} />
          </div>
        </section>

        <CostsEditor costs={data.costs} usdBrl={data.usdBrl} />

        <p className="muted ownFoot">
          Só você vê esta página. Ela não tem link no site nem no app e atualiza sozinha a cada minuto.
          {data.aiCostMonth === null && ' Para o custo da API da Claude entrar sozinho, crie uma chave de admin na Anthropic e salve como ANTHROPIC_ADMIN_KEY na Vercel.'}
        </p>
        </>
        )}
      </main>
    </div>
  );
}
