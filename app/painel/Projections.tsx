'use client';

import { useEffect, useMemo, useState } from 'react';
import { PLANS } from '@/lib/plans';
import type { OwnerData } from '@/lib/owner';
import { Kpi } from './Kpi';

// Aba "Rumo aos 1.000": simulador de projeção + funil real x hipótese + o que fazer agora.
// As premissas ficam salvas só neste navegador (localStorage). Os números reais vêm do painel (Stripe + banco).

type Inputs = {
  target: number; // assinantes
  months: number; // prazo
  mixBasic: number; // %
  mixPro: number; // %
  founders: number; // clientes no preço Founders
  churn: number; // % ao mês
  cac: number; // R$ por pagante
  budgetDay: number; // R$ por dia hoje
  tax: number; // %
  aiUsd: number; // US$ por assinante/mês
  team: number; // R$/mês
  infra: number; // R$/mês
  other: number; // R$/mês
};

const DEFAULTS: Inputs = { target: 1000, months: 12, mixBasic: 50, mixPro: 45, founders: 200, churn: 6, cac: 125, budgetDay: 30, tax: 15, aiUsd: 1.5, team: 15000, infra: 2000, other: 1500 };
const KEY = 'painel:projecoes:v1';
const STRIPE_PCT = 0.0399;
const STRIPE_FIX = 0.39;
// Hipóteses do funil (as mesmas do plano de aquisição)
const HYP = { visitToSignup: 0.12, signupToTrial: 0.35, trialToPaid: 0.5 };

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (n: number) => Math.round(n).toLocaleString('pt-BR');
const pc = (n: number, d = 0) => `${(n * 100).toFixed(d).replace('.', ',')}%`;

type Model = ReturnType<typeof model>;

function model(i: Inputs, usdBrl: number, base0: number) {
  const mixMulti = Math.max(0, 100 - i.mixBasic - i.mixPro) / 100;
  const mb = i.mixBasic / 100;
  const mp = i.mixPro / 100;
  const full = mb * PLANS.basic.priceFull + mp * PLANS.pro.priceFull + mixMulti * PLANS.multi.priceFull;
  const fnd = mb * (PLANS.basic.priceFounders ?? PLANS.basic.priceFull) + mp * (PLANS.pro.priceFounders ?? PLANS.pro.priceFull) + mixMulti * (PLANS.multi.priceFounders ?? PLANS.multi.priceFull);
  const n = Math.max(1, i.target);
  const f = Math.min(i.founders, n);
  const ticket = (f * fnd + (n - f) * full) / n;
  const mrr = ticket * n;
  const stripe = mrr * STRIPE_PCT + n * STRIPE_FIX;
  const taxes = mrr * (i.tax / 100);
  const ai = n * i.aiUsd * usdBrl;
  const c = i.churn / 100;
  const replace = n * c * i.cac;
  const costs = stripe + taxes + ai + i.infra + i.team + i.other + replace;
  const profit = mrr - costs;
  const unitMargin = ticket - ticket * STRIPE_PCT - STRIPE_FIX - ticket * (i.tax / 100) - i.aiUsd * usdBrl;
  const ltv = c > 0 ? unitMargin / c : unitMargin * 60;
  const payback = unitMargin > 0 ? i.cac / unitMargin : Infinity;

  // Caminho: adições brutas constantes por mês para chegar na meta no prazo, repondo cancelamentos.
  const T = Math.max(1, i.months);
  const keep = Math.pow(1 - c, T);
  const adds = c > 0 ? Math.max(0, ((n - base0 * keep) * c) / (1 - keep)) : Math.max(0, (n - base0) / T);
  const path: number[] = [];
  let b = base0;
  for (let m = 1; m <= T; m++) {
    b = b * (1 - c) + adds;
    path.push(b);
  }
  const adsMonth = adds * i.cac;
  // No ritmo de hoje
  const addsNow = (i.budgetDay * 30) / Math.max(1, i.cac);
  const ceiling = c > 0 ? addsNow / c : Infinity;
  let monthsNow: number | null = null;
  let bn = base0;
  for (let m = 1; m <= 240; m++) {
    bn = bn * (1 - c) + addsNow;
    if (bn >= n) {
      monthsNow = m;
      break;
    }
  }
  return { full, fnd, ticket, mrr, stripe, taxes, ai, replace, costs, profit, margin: mrr ? profit / mrr : 0, unitMargin, ltv, ltvCac: i.cac ? ltv / i.cac : 0, payback, adds, adsMonth, path, addsNow, ceiling, monthsNow, n };
}

function Field({ label, value, onChange, min, max, step, suffix, prefix, hint }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; suffix?: string; prefix?: string; hint?: string }) {
  return (
    <label className="prjField">
      <span className="prjFieldTop">
        <span>{label}</span>
        <span className="prjFieldVal">
          {prefix}
          <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value) || 0)} aria-label={label} />
          {suffix}
        </span>
      </span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} aria-hidden="true" tabIndex={-1} />
      {hint && <span className="prjHint">{hint}</span>}
    </label>
  );
}

function PathChart({ path, base0, target }: { path: number[]; base0: number; target: number }) {
  const W = 640;
  const H = 200;
  const pad = 28;
  const max = Math.max(target, ...path, 1);
  const bw = (W - pad * 2) / Math.max(1, path.length);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="prjChart" role="img" aria-label={`Assinantes por mês até a meta de ${target}`}>
      <line x1={pad} x2={W - pad} y1={y(target)} y2={y(target)} className="prjTarget" />
      <text x={W - pad} y={y(target) - 6} textAnchor="end" className="prjLbl">meta {num(target)}</text>
      {path.map((v, k) => (
        <g key={k}>
          <rect x={pad + k * bw + bw * 0.18} y={y(v)} width={bw * 0.64} height={H - pad - y(v)} rx="3" className="prjBar">
            <title>{`Mês ${k + 1}: ${num(v)} assinantes`}</title>
          </rect>
          {(k === path.length - 1 || k % Math.ceil(path.length / 6) === 0) && (
            <text x={pad + k * bw + bw / 2} y={H - 8} textAnchor="middle" className="prjLbl">{`m${k + 1}`}</text>
          )}
        </g>
      ))}
      <text x={pad} y={14} className="prjLbl">hoje: {num(base0)}</text>
    </svg>
  );
}

type Insight = { tag: 'Agora' | 'Próximo' | 'Atenção'; title: string; text: string };

function insights(i: Inputs, m: Model, real: { visitors: number; signups: number; trials: number; paying: number; adSpend: number }, base: Model, usdBrl: number): Insight[] {
  const out: Insight[] = [];
  const vToS = real.visitors >= 100 ? real.signups / real.visitors : null;
  const sToT = real.signups >= 20 ? real.trials / real.signups : null;

  if (real.paying < 10) {
    out.push({
      tag: 'Agora',
      title: 'Valide antes de escalar',
      text: `Hoje são ${num(real.signups)} cadastros no mês, ${num(real.trials)} em teste e ${num(real.paying)} pagantes. Mantenha R$ ${num(i.budgetDay)}/dia até ter 50 cadastros e 10 pagantes: é aí que o CAC e as taxas do funil deixam de ser chute.`,
    });
  }
  if (vToS !== null && vToS < 0.08) {
    out.push({ tag: 'Agora', title: 'O gargalo é a página', text: `Só ${pc(vToS, 1)} dos visitantes se cadastram (hipótese: ${pc(HYP.visitToSignup)}). Teste outro título no topo do /vendedores e um botão de cadastro acima da dobra antes de colocar mais dinheiro em anúncio.` });
  }
  if (sToT !== null && sToT < 0.25) {
    out.push({ tag: 'Agora', title: 'O pedido de cartão está travando', text: `Só ${pc(sToT, 1)} dos cadastros iniciam o teste (hipótese: ${pc(HYP.signupToTrial)}). Reforce na tela de pagamento que nada é cobrado em 7 dias e que dá para cancelar em 1 clique; se não melhorar, teste o período grátis sem cartão.` });
  }

  const daily = m.adsMonth / 30;
  out.push({
    tag: real.paying < 10 ? 'Próximo' : 'Agora',
    title: `Orçamento para ${num(i.target)} em ${i.months} meses`,
    text:
      m.monthsNow === null
        ? `No ritmo de R$ ${num(i.budgetDay)}/dia a base estabiliza em ~${num(m.ceiling)} assinantes (o cancelamento come o que entra). Para a meta, são ~${num(m.adds)} novos pagantes/mês: ${brl(m.adsMonth)}/mês (~R$ ${num(daily)}/dia). Suba 20% a cada 3 dias enquanto o custo por teste ficar abaixo de ${brl(i.cac * HYP.trialToPaid)}.`
        : `No ritmo de R$ ${num(i.budgetDay)}/dia você chega lá em ~${m.monthsNow} meses. Para ${i.months} meses, são ~${num(m.adds)} novos pagantes/mês: ${brl(m.adsMonth)}/mês (~R$ ${num(daily)}/dia). Suba 20% a cada 3 dias enquanto o custo por teste ficar abaixo de ${brl(i.cac * HYP.trialToPaid)}.`,
  });

  if (m.ltvCac >= 3) {
    out.push({ tag: 'Próximo', title: 'A conta permite acelerar', text: `Cada pagante deixa ~${brl(m.ltv)} de margem na vida toda e custa ${brl(i.cac)} para trazer: ${m.ltvCac.toFixed(1).replace('.', ',')}x. Acima de 3x, aumentar investimento é seguro, desde que o CAC real (não o chutado) confirme.` });
  } else {
    out.push({ tag: 'Atenção', title: 'Não acelere com esse CAC', text: `LTV/CAC de ${m.ltvCac.toFixed(1).replace('.', ',')}x está abaixo de 3x. Antes de escalar, baixe o CAC (criativos, página, indicação) ou o cancelamento.` });
  }

  // Alavanca do cancelamento
  const better: Inputs = { ...i, churn: Math.max(1, i.churn - 2) };
  const mb = model(better, usdBrl, real.paying);
  out.push({
    tag: 'Próximo',
    title: `Cancelamento é a maior alavanca`,
    text: `Cair de ${i.churn}% para ${better.churn}% ao mês soma ${brl(mb.profit - m.profit)}/mês de lucro na meta e reduz o orçamento de anúncios para chegar lá em ${brl(m.adsMonth - mb.adsMonth)}/mês. Foque em encantar no primeiro lote de posts e em mostrar resultado no dia 5 do teste.`,
  });

  // Preço
  const gain = (m.full - m.fnd) * 100;
  out.push({ tag: 'Atenção', title: 'Feche o Founders na hora certa', text: `Cada 100 clientes no preço cheio em vez do Founders = +${brl(gain)}/mês. Encerre o Founders ao chegar em ${num(i.founders)} clientes e use o fim da oferta como gatilho de urgência.` });

  // Mix
  const mixGain = 0.1 * i.target * (PLANS.pro.priceFull - PLANS.basic.priceFull);
  out.push({ tag: 'Próximo', title: 'Puxe o mix para o Pro', text: `Levar 10 pontos do Basic para o Pro na meta vale +${brl(mixGain)}/mês. Destaque o Pro como recomendado e mostre no teste o limite de 10 posts do Basic.` });

  // Canais
  out.push({ tag: 'Próximo', title: 'Diminua a dependência da Meta', text: `Com 10 pagantes, separe 20% da verba para testar LinkedIn Ads e lance a indicação (1 mês grátis por cliente indicado). Cada 10% de clientes vindos sem anúncio reduz o CAC médio em ~10%.` });

  if (real.adSpend > 0 && real.paying > 0) {
    out.push({ tag: 'Agora', title: 'CAC real até aqui', text: `${brl(real.adSpend)} em anúncios para ${num(real.paying)} pagantes = ${brl(real.adSpend / real.paying)} por pagante. Use esse número no campo CAC quando passar de 10 pagantes.` });
  }
  out.push({ tag: 'Atenção', title: 'Imposto: confira o Fator R', text: `Com folha abaixo de 28% do faturamento a empresa cai no Anexo V do Simples (~20% em vez de ~15%). Na meta, essa diferença é ~${brl(m.mrr * 0.05)}/mês. Alinhe pró-labore com o contador.` });
  void base;
  return out;
}

export function Projections({ data }: { data: OwnerData }) {
  const [i, setI] = useState<Inputs>(DEFAULTS);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setI({ ...DEFAULTS, ...(JSON.parse(saved) as Partial<Inputs>) });
    } catch {
      // sem localStorage: usa o padrão
    }
  }, []);
  const set = <K extends keyof Inputs>(k: K) => (v: number) =>
    setI((prev) => {
      const next = { ...prev, [k]: v };
      if (k === 'mixBasic' && next.mixBasic + next.mixPro > 100) next.mixPro = 100 - next.mixBasic;
      if (k === 'mixPro' && next.mixBasic + next.mixPro > 100) next.mixBasic = 100 - next.mixPro;
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // ignora
      }
      return next;
    });
  const reset = () => {
    setI(DEFAULTS);
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignora
    }
  };

  const paying = data.counts.active + data.counts.pastDue;
  const real = {
    visitors: data.visits.visitors30,
    signups: data.app.usersMonth,
    trials: data.counts.trialing + data.counts.active,
    paying,
    adSpend: data.costs.filter((c) => c.category === 'Anúncios').reduce((s, c) => s + c.amount, 0),
  };
  const m = useMemo(() => model(i, data.usdBrl, paying), [i, data.usdBrl, paying]);
  const scen = useMemo(
    () => [
      { name: 'Pessimista', note: 'todos no Founders · churn +4 p.p. · CAC 2x', mm: model({ ...i, founders: i.target, churn: i.churn + 4, cac: i.cac * 2 }, data.usdBrl, paying) },
      { name: 'Base', note: 'as premissas ao lado', mm: m },
      { name: 'Otimista', note: 'sem Founders · churn −2 p.p. · CAC −20%', mm: model({ ...i, founders: 0, churn: Math.max(1, i.churn - 2), cac: i.cac * 0.8 }, data.usdBrl, paying) },
    ],
    [i, m, data.usdBrl, paying],
  );
  const tips = useMemo(() => insights(i, m, real, m, data.usdBrl), [i, m, real.visitors, real.signups, real.trials, real.paying, real.adSpend, data.usdBrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const progress = Math.min(1, paying / Math.max(1, i.target));
  const rows: { label: string; v: number; strong?: boolean }[] = [
    { label: 'Faturamento (MRR)', v: m.mrr, strong: true },
    { label: 'Taxa do Stripe (3,99% + R$ 0,39)', v: -m.stripe },
    { label: `Impostos (${i.tax}%)`, v: -m.taxes },
    { label: `IA da Claude (US$ ${i.aiUsd.toFixed(2).replace('.', ',')}/assinante)`, v: -m.ai },
    { label: 'Infraestrutura', v: -i.infra },
    { label: 'Equipe', v: -i.team },
    { label: 'Contador e ferramentas', v: -i.other },
    { label: `Anúncios para repor cancelamentos (${num(m.n * (i.churn / 100))} × ${brl(i.cac)})`, v: -m.replace },
    { label: 'Lucro', v: m.profit, strong: true },
  ];
  const funnel = [
    { stage: 'Visitantes (30 dias)', real: real.visitors, rate: null as number | null, hyp: null as number | null },
    { stage: 'Cadastros (mês)', real: real.signups, rate: real.visitors ? real.signups / real.visitors : null, hyp: HYP.visitToSignup },
    { stage: 'Testes iniciados', real: real.trials, rate: real.signups ? real.trials / real.signups : null, hyp: HYP.signupToTrial },
    { stage: 'Pagantes', real: paying, rate: data.trialConversion, hyp: HYP.trialToPaid },
  ];

  return (
    <div className="prj">
      <section className="ownBlock" aria-labelledby="h-meta">
        <div className="ownBlockHead">
          <h2 id="h-meta">Rumo aos {num(i.target)} assinantes</h2>
          <span className="muted">{num(paying)} pagantes hoje · {brl(data.mrr)} de MRR</span>
        </div>
        <div className="card prjProgress">
          <div className="prjProgressBar" aria-hidden="true">
            <span style={{ width: `${Math.max(1.5, progress * 100)}%` }} />
          </div>
          <div className="prjProgressText">
            <b>{pc(progress, 1)}</b> da meta · faltam {num(Math.max(0, i.target - paying))} assinantes · MRR na meta: <b>{brl(m.mrr)}</b>
          </div>
        </div>
        <div className="ownKpis five">
          <Kpi label="Faturamento na meta" value={brl(m.mrr)} hint={`${brl(m.mrr * 12)} por ano`} tone="cyan" />
          <Kpi label="Lucro por mês" value={brl(m.profit)} hint={`margem de ${pc(m.margin)}`} tone={m.profit >= 0 ? 'green' : 'pink'} />
          <Kpi label="Ticket médio" value={brl(m.ticket)} hint={`cheio ${brl(m.full)} · Founders ${brl(m.fnd)}`} tone="violet" />
          <Kpi label="LTV / CAC" value={`${m.ltvCac.toFixed(1).replace('.', ',')}x`} hint={`LTV ${brl(m.ltv)} · CAC ${brl(i.cac)}`} tone={m.ltvCac >= 3 ? 'green' : 'amber'} />
          <Kpi label="Payback do CAC" value={Number.isFinite(m.payback) ? `${m.payback.toFixed(1).replace('.', ',')} meses` : '—'} hint="meses de margem para pagar o anúncio" tone="amber" />
        </div>
      </section>

      <div className="prjGrid">
        <section className="card ownSection prjInputs" aria-labelledby="h-prem">
          <div className="ownSectionHead">
            <h2 id="h-prem">Premissas</h2>
            <button type="button" className="linkBtn" onClick={reset}>Voltar ao padrão</button>
          </div>
          <p className="muted prjNote">Mexa e veja tudo recalcular. Fica salvo só neste navegador.</p>
          <div className="prjGroup">Meta</div>
          <Field label="Assinantes" value={i.target} onChange={set('target')} min={100} max={10000} step={100} />
          <Field label="Prazo" value={i.months} onChange={set('months')} min={3} max={36} step={1} suffix=" meses" />
          <div className="prjGroup">Preço</div>
          <Field label="Basic" value={i.mixBasic} onChange={set('mixBasic')} min={0} max={100} step={5} suffix="%" />
          <Field label="Pro" value={i.mixPro} onChange={set('mixPro')} min={0} max={100} step={5} suffix="%" hint={`Multi fica com ${Math.max(0, 100 - i.mixBasic - i.mixPro)}%`} />
          <Field label="Clientes no Founders" value={i.founders} onChange={set('founders')} min={0} max={2000} step={50} />
          <div className="prjGroup">Aquisição e retenção</div>
          <Field label="Cancelamento" value={i.churn} onChange={set('churn')} min={1} max={20} step={0.5} suffix="% /mês" />
          <Field label="CAC" value={i.cac} onChange={set('cac')} min={20} max={600} step={5} prefix="R$ " hint={real.paying >= 10 && real.adSpend ? `real até aqui: ${brl(real.adSpend / real.paying)}` : 'chute até ter 10 pagantes'} />
          <Field label="Anúncios hoje" value={i.budgetDay} onChange={set('budgetDay')} min={0} max={2000} step={5} prefix="R$ " suffix=" /dia" />
          <div className="prjGroup">Custos</div>
          <Field label="Impostos" value={i.tax} onChange={set('tax')} min={0} max={30} step={0.5} suffix="%" />
          <Field label="IA por assinante" value={i.aiUsd} onChange={set('aiUsd')} min={0} max={10} step={0.1} prefix="US$ " suffix=" /mês" />
          <Field label="Equipe" value={i.team} onChange={set('team')} min={0} max={100000} step={1000} prefix="R$ " />
          <Field label="Infraestrutura" value={i.infra} onChange={set('infra')} min={0} max={20000} step={100} prefix="R$ " />
          <Field label="Contador e ferramentas" value={i.other} onChange={set('other')} min={0} max={20000} step={100} prefix="R$ " />
        </section>

        <div className="prjCol">
          <section className="card ownSection" aria-labelledby="h-dre">
            <div className="ownSectionHead"><h2 id="h-dre">Um mês com {num(i.target)} assinantes</h2><span className="muted">R$ por mês</span></div>
            <div className="ownTableWrap">
              <table className="ownTable prjDre">
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className={r.strong ? 'strong' : ''}>
                      <td>{r.label}</td>
                      <td className={r.v < 0 ? 'neg' : 'pos'}>{brl(r.v)}</td>
                      <td className="muted">{m.mrr ? pc(Math.abs(r.v) / m.mrr) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card ownSection" aria-labelledby="h-path">
            <div className="ownSectionHead"><h2 id="h-path">O caminho até lá</h2><span className="muted">assinantes no fim de cada mês</span></div>
            <PathChart path={m.path} base0={paying} target={i.target} />
            <div className="ownMini prjMini">
              <div><span className="muted">Novos pagantes/mês</span><b>{num(m.adds)}</b></div>
              <div><span className="muted">Anúncios/mês</span><b>{brl(m.adsMonth)}</b></div>
              <div><span className="muted">Por dia</span><b>{brl(m.adsMonth / 30)}</b></div>
              <div><span className="muted">No ritmo de hoje</span><b>{m.monthsNow === null ? `teto ~${num(m.ceiling)}` : `${m.monthsNow} meses`}</b></div>
            </div>
          </section>

          <section className="card ownSection" aria-labelledby="h-cen">
            <div className="ownSectionHead"><h2 id="h-cen">Cenários</h2><span className="muted">na meta</span></div>
            <div className="ownTableWrap">
              <table className="ownTable">
                <thead>
                  <tr><th>Cenário</th><th>Ticket</th><th>Faturamento</th><th>Lucro/mês</th><th>Anúncios/mês</th></tr>
                </thead>
                <tbody>
                  {scen.map((s) => (
                    <tr key={s.name} className={s.name === 'Base' ? 'strong' : ''}>
                      <td><b>{s.name}</b><br /><span className="muted" style={{ fontSize: 12 }}>{s.note}</span></td>
                      <td>{brl(s.mm.ticket)}</td>
                      <td>{brl(s.mm.mrr)}</td>
                      <td className={s.mm.profit < 0 ? 'neg' : 'pos'}>{brl(s.mm.profit)}</td>
                      <td>{brl(s.mm.adsMonth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <div className="ownGrid2">
        <section className="card ownSection" aria-labelledby="h-fun">
          <div className="ownSectionHead"><h2 id="h-fun">Funil real x hipótese</h2><span className="muted">dados do site e do Stripe</span></div>
          <div className="ownTableWrap">
            <table className="ownTable">
              <thead><tr><th>Etapa</th><th>Real</th><th>Taxa real</th><th>Hipótese</th></tr></thead>
              <tbody>
                {funnel.map((f) => {
                  const ok = f.rate === null || f.hyp === null ? null : f.rate >= f.hyp;
                  return (
                    <tr key={f.stage}>
                      <td>{f.stage}</td>
                      <td><b>{num(f.real)}</b></td>
                      <td>{f.rate === null ? '—' : <span className={`ownStatus ${ok ? 'ok' : 'warn'}`}>{pc(f.rate, 1)}</span>}</td>
                      <td className="muted">{f.hyp === null ? '—' : pc(f.hyp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted prjNote">Com poucos dados as taxas oscilam muito. Leia como tendência depois de ~100 visitantes e ~20 cadastros.</p>
        </section>

        <section className="card ownSection" aria-labelledby="h-ins">
          <div className="ownSectionHead"><h2 id="h-ins">O que fazer agora</h2><span className="muted">recalcula com os números</span></div>
          <ol className="prjTips">
            {tips.map((t) => (
              <li key={t.title}>
                <span className={`prjTag ${t.tag === 'Agora' ? 'now' : t.tag === 'Atenção' ? 'warn' : 'next'}`}>{t.tag}</span>
                <div>
                  <b>{t.title}</b>
                  <p>{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <p className="muted prjNote">Projeções são estimativas para planejar, não promessa de resultado. Impostos e estrutura societária: confirme com o seu contador.</p>
    </div>
  );
}
