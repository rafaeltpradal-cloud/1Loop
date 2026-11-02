'use client';

// Aba Usuários do painel: quem são, em que etapa está cada um, o que usam e quem precisa de um empurrão.
import { Fragment, useMemo, useState } from 'react';
import { PLANS } from '@/lib/plans';
import type { OwnerUser, Stage } from '@/lib/ownerUsers';
import { Kpi } from './Kpi';

const DAY = 86400000;

const STAGE: Record<Stage, { label: string; cls: string }> = {
  cadastrou: { label: 'Só cadastrou', cls: 'off' },
  entrevista: { label: 'Na entrevista', cls: 'trial' },
  estrategia: { label: 'Estratégia pronta', cls: 'trial' },
  post: { label: 'Gerou post', cls: 'info' },
  pagamento: { label: 'Foi ao pagamento', cls: 'info' },
  teste: { label: 'Em teste', cls: 'cyan' },
  pagante: { label: 'Pagante', cls: 'ok' },
  atrasado: { label: 'Pagamento atrasado', cls: 'warn' },
  cancelado: { label: 'Cancelou', cls: 'off' },
};

const EMAIL: Record<string, string> = {
  pv1: 'Lembrete 1 (você quase concluiu)',
  pv2: 'Lembrete 2 (perfil parado)',
  pv3: 'Lembrete 3 (constância)',
  fd1: 'Founders: véspera do prazo',
  fd2: 'Founders: último dia',
  ext1: 'Aviso de prorrogação do Founders',
  of1: 'Desculpas + 10% no 1º mês',
};

const NET: Record<string, string> = { linkedin: 'LinkedIn', linkedin_page: 'Página LI', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', threads: 'Threads' };

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
const dayTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
function ago(iso: string | null, now: number) {
  if (!iso) return '—';
  const ms = now - Date.parse(iso);
  if (ms < 60 * 60000) return `há ${Math.max(1, Math.round(ms / 60000))} min`;
  if (ms < DAY) return `há ${Math.round(ms / 3600000)} h`;
  const d = Math.floor(ms / DAY);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
const lastOf = (u: OwnerUser) => [u.lastSeen, u.lastAction].filter((x): x is string => !!x).sort().at(-1) ?? null;
const realSub = (u: OwnerUser) => !!u.sub && !u.sub.status.startsWith('banco:');
const active = (u: OwnerUser, now: number) => {
  const t = lastOf(u);
  return !!t && now - Date.parse(t) < 7 * DAY;
};
function whatsapp(phone: string | null) {
  const d = (phone ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

/** Quem precisa de uma ação sua agora, do mais quente para o mais frio. */
function todo(users: OwnerUser[], now: number) {
  const out: { u: OwnerUser; why: string; action: string; weight: number }[] = [];
  for (const u of users) {
    const idle = now - Date.parse(lastOf(u) ?? u.createdAt);
    const talk = whatsapp(u.phone) ? 'chame no WhatsApp' : 'mande um e-mail pessoal';
    if (u.stage === 'atrasado') out.push({ u, weight: 100, why: 'Pagamento recusado', action: 'Avise e mande o link para trocar o cartão' });
    else if (u.stage === 'teste' && u.sub?.trialEnd && Date.parse(u.sub.trialEnd) - now < 2 * DAY)
      out.push({ u, weight: 90, why: `Teste acaba em ${day(u.sub.trialEnd)}`, action: u.posts.published ? 'Pergunte como foram os posts publicados' : 'Ajude a publicar o 1º post antes da cobrança' });
    else if (u.stage === 'pagamento')
      out.push({ u, weight: 80, why: 'Chegou ao pagamento e não assinou', action: u.offer ? `Já recebeu a oferta de 10%: ${talk}` : `Pergunte o que faltou: ${talk}` });
    else if (u.stage === 'post' && idle > DAY) out.push({ u, weight: 70, why: `Gerou ${u.posts.total} post${u.posts.total > 1 ? 's' : ''} e parou`, action: 'Mostre o próximo post e convide para o teste' });
    else if (u.stage === 'estrategia' && idle > DAY) out.push({ u, weight: 60, why: 'Tem estratégia, não gerou post', action: 'Convide a gerar o 1º post (1 clique)' });
    else if (u.stage === 'entrevista' && idle > DAY)
      out.push({ u, weight: 50, why: `Parou na pergunta ${u.interview.answered + 1} de ${u.interview.total}`, action: 'Lembre que faltam 5 minutos' });
    else if (u.stage === 'cadastrou' && idle > 6 * 3600000) out.push({ u, weight: 40, why: 'Criou a conta e não começou', action: 'Mande boas-vindas e o link da entrevista' });
    if (u.posts.errors > 0) out.push({ u, weight: 95, why: `${u.posts.errors} post${u.posts.errors > 1 ? 's' : ''} com erro ao publicar`, action: 'Veja o erro e reconecte a rede' });
    if (realSub(u) && u.networks.some((n) => n.expired)) out.push({ u, weight: 85, why: 'Conexão com a rede expirou', action: 'Peça para reconectar em Redes' });
  }
  return out.sort((a, b) => b.weight - a.weight || Date.parse(lastOf(b.u) ?? b.u.createdAt) - Date.parse(lastOf(a.u) ?? a.u.createdAt));
}

function Journey({ u }: { u: OwnerUser }) {
  const steps: [string, boolean][] = [
    [`Entrevista ${u.interview.done ? 'concluída' : `${u.interview.answered}/${u.interview.total}`}`, u.interview.done],
    ['Estratégia', u.strategies > 0],
    ['1º post', u.posts.total > 0],
    ['Pagamento', u.reachedCheckout || realSub(u)],
    ['Assinatura', realSub(u)],
  ];
  return (
    <span className="ownSteps" aria-label={steps.map(([l, ok]) => `${l}: ${ok ? 'sim' : 'não'}`).join(', ')}>
      {steps.map(([l, ok], i) => (
        <span key={l} title={l} className={ok ? 'on' : i === 0 && u.interview.answered > 0 ? 'half' : ''} />
      ))}
    </span>
  );
}

type Filter = 'todas' | 'ativas' | 'paradas' | 'pagamento' | 'assinantes' | 'equipe';
type Period = '7' | '30' | 'tudo';

export function UsersView({ users, updatedAt }: { users: OwnerUser[]; updatedAt: string }) {
  const now = Date.parse(updatedAt);
  const [filter, setFilter] = useState<Filter>('todas');
  const [period, setPeriod] = useState<Period>('tudo');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const clients = useMemo(() => users.filter((u) => !u.internal), [users]);
  const inPeriod = useMemo(() => (period === 'tudo' ? clients : clients.filter((u) => now - Date.parse(u.createdAt) < Number(period) * DAY)), [clients, period, now]);

  const funnel = useMemo(() => {
    const n = (f: (u: OwnerUser) => boolean) => inPeriod.filter(f).length;
    return [
      { label: 'Criaram conta', v: inPeriod.length },
      { label: 'Começaram a entrevista', v: n((u) => u.interview.answered > 0 || u.interview.done || u.strategies > 0) },
      { label: 'Receberam a estratégia', v: n((u) => u.strategies > 0) },
      { label: 'Geraram o 1º post', v: n((u) => u.posts.total > 0) },
      { label: 'Foram ao pagamento', v: n((u) => u.reachedCheckout || realSub(u)) },
      { label: 'Começaram o teste', v: n((u) => realSub(u)) },
      { label: 'Pagantes', v: n((u) => u.stage === 'pagante' || u.stage === 'atrasado') },
    ];
  }, [inPeriod]);

  const actions = useMemo(() => todo(clients, now), [clients, now]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === 'equipe' ? !u.internal : u.internal) return false;
      if (filter === 'ativas' && !active(u, now)) return false;
      if (filter === 'paradas' && (active(u, now) || realSub(u))) return false;
      if (filter === 'pagamento' && u.stage !== 'pagamento') return false;
      if (filter === 'assinantes' && !realSub(u)) return false;
      return !term || `${u.name} ${u.email} ${u.origem?.ad ?? ''}`.toLowerCase().includes(term);
    });
  }, [users, filter, q, now]);

  const subs = clients.filter(realSub);
  const new7 = clients.filter((u) => now - Date.parse(u.createdAt) < 7 * DAY).length;
  const top = funnel[0].v || 1;
  const filters: [Filter, string, number][] = [
    ['todas', 'Todas', clients.length],
    ['ativas', 'Ativas', clients.filter((u) => active(u, now)).length],
    ['paradas', 'Paradas', clients.filter((u) => !active(u, now) && !realSub(u)).length],
    ['pagamento', 'Pagamento sem assinar', clients.filter((u) => u.stage === 'pagamento').length],
    ['assinantes', 'Assinantes', subs.length],
    ['equipe', 'Equipe', users.length - clients.length],
  ];

  return (
    <>
      <section aria-labelledby="h-contas" className="ownBlock">
        <div className="ownBlockHead">
          <h2 id="h-contas">Contas de clientes</h2>
          <span className="muted">sem as contas da equipe · ativa = abriu o app ou fez algo nos últimos 7 dias</span>
        </div>
        <div className="ownKpis six">
          <Kpi label="Contas" value={String(clients.length)} hint={`${new7} nos últimos 7 dias`} tone="cyan" />
          <Kpi label="Ativas (7 dias)" value={String(filters[1][2])} hint={`${filters[2][2]} parada${filters[2][2] === 1 ? '' : 's'}`} tone="green" />
          <Kpi label="Geraram post" value={String(clients.filter((u) => u.posts.total > 0).length)} hint={`${clients.reduce((s, u) => s + u.posts.total, 0)} posts no total`} tone="violet" />
          <Kpi label="Publicaram" value={String(clients.filter((u) => u.posts.published > 0).length)} hint={`${clients.filter((u) => u.networks.some((x) => !x.expired)).length} com rede conectada`} tone="violet" />
          <Kpi label="Foram ao pagamento" value={String(clients.filter((u) => u.reachedCheckout || realSub(u)).length)} hint={`${filters[3][2]} ainda sem assinar`} tone="amber" />
          <Kpi label="Assinantes" value={String(subs.length)} hint={`${subs.filter((u) => u.stage === 'teste').length} em teste · ${subs.filter((u) => u.stage === 'pagante').length} pagantes`} tone="pink" />
        </div>
      </section>

      <div className="ownGrid2">
        <section className="card ownSection" aria-labelledby="h-jornada">
          <div className="ownSectionHead">
            <h2 id="h-jornada">Jornada no app</h2>
            <div className="segmented" role="radiogroup" aria-label="Período do cadastro">
              {(['7', '30', 'tudo'] as Period[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}>
                  {p === 'tudo' ? 'Tudo' : `${p} dias`}
                </button>
              ))}
            </div>
          </div>
          <ol className="ownJourney">
            {funnel.map((s, i) => (
              <li key={s.label}>
                <span className="ownJLabel">{s.label}</span>
                <span className="ownJBar"><span style={{ width: `${Math.max(s.v ? 4 : 0, (s.v / top) * 100)}%` }} /></span>
                <b>{s.v}</b>
                <span className="muted ownJPct">{i === 0 ? '' : funnel[0].v ? `${Math.round((s.v / funnel[0].v) * 100)}%` : '—'}</span>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ fontSize: 12 }}>Contas criadas no período. A % é sobre quem criou a conta.</p>
        </section>

        <section className="card ownSection" aria-labelledby="h-acao">
          <div className="ownSectionHead">
            <h2 id="h-acao">Precisa de você</h2>
            <span className="muted">{actions.length ? `${actions.length} ${actions.length === 1 ? 'ação' : 'ações'} · mais quente primeiro` : 'ninguém travado'}</span>
          </div>
          {actions.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Ninguém parado agora. Quando alguém travar em uma etapa, aparece aqui com o que fazer.</p>
          ) : (
            <ol className="ownTodo">
              {actions.slice(0, 8).map(({ u, why, action }, i) => {
                const wa = whatsapp(u.phone);
                return (
                  <li key={`${u.id}-${i}`}>
                    <span className="ownTodoText">
                      <b>{u.name || u.email}</b>
                      <span>{why}</span>
                      <span className="muted">{action}</span>
                    </span>
                    <span className="ownTodoLinks">
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="ownChip wa">WhatsApp</a>}
                      <a href={`mailto:${u.email}`} className="ownChip">E-mail</a>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="card ownSection" aria-labelledby="h-lista">
        <div className="ownSectionHead">
          <h2 id="h-lista">Todas as contas</h2>
          <input className="input ownSearch" type="search" placeholder="Buscar nome, e-mail ou anúncio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar conta" />
        </div>
        <div className="ownFilters" role="radiogroup" aria-label="Filtrar contas">
          {filters.map(([f, label, n]) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)} className={filter === f ? 'on' : ''}>
              {label} <span>{n}</span>
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Nenhuma conta neste filtro.</p>
        ) : (
          <div className="ownTableWrap">
            <table className="ownTable ownUsers">
              <thead>
                <tr><th>Pessoa</th><th>Etapa</th><th>Jornada</th><th>Uso</th><th>Origem</th><th>Cadastro</th><th>Última atividade</th><th aria-label="Detalhes" /></tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const st = u.sub?.status.startsWith('banco:') ? { label: 'Acesso liberado (sem cobrança)', cls: 'off' } : STAGE[u.stage];
                  const wa = whatsapp(u.phone);
                  const isOpen = open === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr className={isOpen ? 'open' : ''}>
                        <td>
                          <b>{u.name || u.email.split('@')[0]}</b>
                          <span className="muted ownSub">{u.email}</span>
                        </td>
                        <td>
                          <span className={`ownStatus ${st.cls}`}>{st.label}</span>
                          <span className="muted ownSub">
                            {PLANS[u.sub?.plan ?? u.plan]?.name ?? '—'}
                            {u.sub?.trialEnd && u.stage === 'teste' ? ` · cobra em ${day(u.sub.trialEnd)}` : ''}
                            {u.sub && u.sub.mrr > 0 ? ` · R$ ${u.sub.mrr.toFixed(2).replace('.', ',')}/mês` : ''}
                            {u.offer ? ' · oferta 10%' : ''}
                          </span>
                        </td>
                        <td><Journey u={u} /></td>
                        <td>
                          <span>{u.posts.total ? `${u.posts.total} post${u.posts.total > 1 ? 's' : ''}` : <span className="muted">sem posts</span>}</span>
                          <span className="muted ownSub">
                            {[u.posts.approved && `${u.posts.approved} aprov.`, u.posts.scheduled && `${u.posts.scheduled} agend.`, u.posts.published && `${u.posts.published} public.`, u.posts.errors && `${u.posts.errors} erro`].filter(Boolean).join(' · ') ||
                              (u.networks.length ? '' : 'nenhuma rede')}
                          </span>
                          {u.networks.length > 0 && (
                            <span className="ownNets">
                              {u.networks.map((n) => (
                                <span key={n.network} className={n.expired ? 'exp' : ''} title={n.expired ? 'conexão expirada' : 'conectada'}>{NET[n.network] ?? n.network}</span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td>
                          {u.origem ? (
                            <>
                              <span>{u.origem.source}</span>
                              {u.origem.ad && <span className="muted ownSub" title={u.origem.campaign ?? ''}>{u.origem.ad}</span>}
                            </>
                          ) : (
                            <span className="muted">direto</span>
                          )}
                        </td>
                        <td>{day(u.createdAt)}</td>
                        <td>
                          <span className={active(u, now) ? 'ownLive on' : 'ownLive'} aria-hidden="true" />
                          {ago(lastOf(u), now)}
                        </td>
                        <td>
                          <button type="button" className="linkBtn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : u.id)}>{isOpen ? 'Fechar' : 'Ver'}</button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="ownDetail">
                          <td colSpan={8}>
                            <div className="ownDetailGrid">
                              <div>
                                <span className="muted">Contato</span>
                                <span>{u.email}</span>
                                {u.phone && <span>{u.phone}</span>}
                                <span className="ownTodoLinks">
                                  {wa && <a href={wa} target="_blank" rel="noreferrer" className="ownChip wa">WhatsApp</a>}
                                  <a href={`mailto:${u.email}`} className="ownChip">E-mail</a>
                                </span>
                              </div>
                              <div>
                                <span className="muted">No app</span>
                                <span>Entrevista: {u.interview.done ? 'concluída' : `${u.interview.answered} de ${u.interview.total}`}</span>
                                <span>Estratégias: {u.strategies} · Posts: {u.posts.total}</span>
                                <span>Último acesso: {u.lastSeen ? dayTime(u.lastSeen) : '—'} · Última ação: {u.lastAction ? dayTime(u.lastAction) : '—'}</span>
                              </div>
                              <div>
                                <span className="muted">E-mails automáticos recebidos{u.optout ? ' · pediu para sair' : ''}</span>
                                {u.emails.length === 0 ? <span className="muted">nenhum</span> : u.emails.map((e) => <span key={e.kind}>{dayTime(e.at)} · {EMAIL[e.kind] ?? e.kind}</span>)}
                              </div>
                              <div>
                                <span className="muted">Origem</span>
                                <span>{u.origem ? [u.origem.source, u.origem.campaign, u.origem.ad].filter(Boolean).join(' · ') : 'direto'}</span>
                                <span className="muted">Cadastro em {dayTime(u.createdAt)}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: 12 }}>
          Jornada: entrevista · estratégia · 1º post · pagamento · assinatura. A situação da assinatura vem do Stripe (modo real); “acesso liberado” é conta com acesso dado à mão ou de teste, sem cobrança.
        </p>
      </section>
    </>
  );
}
