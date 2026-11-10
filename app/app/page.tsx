import { currencyOf, EUR_PRICES } from '@/lib/market';
import Link from 'next/link';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { LoopMark } from '@/components/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrackOnce } from '@/components/Tracking';
import { priceNow } from '@/lib/founders';
import type { Strategy } from '@/lib/strategy';
import { addDays, fromISO, isoInBrazil, itemDate, planStartFrom } from '@/lib/dates';
import { NetworkIcon } from '@/components/NetworkIcon';
import { networkByName } from '@/lib/networks';

export const metadata = { title: 'Início · 1loop creators' };

type WeekPost = { id: number; item_index: number; status: string; date: string; tema: string; rede: string; scheduled_at: string | null; published_at: string | null; external_url: string | null };

const STATUS: Record<string, { label: string; cls: string }> = {
  falta: { label: 'Gerar', cls: 'todo' },
  rascunho: { label: 'Revisar', cls: 'draft' },
  aprovado: { label: 'Aprovado', cls: 'ok' },
  agendado: { label: 'Agendado', cls: 'sched' },
  publicando: { label: 'Publicando', cls: 'sched' },
  publicado: { label: 'Publicado', cls: 'done' },
  erro: { label: 'Erro', cls: 'err' },
};

const weekday = (iso: string) => fromISO(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
const dm = (iso: string) => `${Number(iso.slice(8))}/${Number(iso.slice(5, 7))}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace('.', '');

/** Semanas seguidas (até a atual) com pelo menos 1 post publicado. A semana atual sem post ainda não quebra a sequência. */
function streakOf(published: string[], today: string) {
  const monday = (iso: string) => addDays(iso, -((fromISO(iso).getDay() + 6) % 7));
  const weeks = new Set(published.map((d) => monday(isoInBrazil(new Date(d)))));
  let w = monday(today);
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

export default async function AppHome({ searchParams }: { searchParams: Promise<{ assinou?: string }> }) {
  const { assinou } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: interview }, { count: networks }, { data: strategyRow }, { data: allPosts }] = await Promise.all([
    supabase.from('interviews').select('answers, completed_at').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle(),
    // Conta como feito só com a publicação automática conectada (LinkedIn ou Instagram).
    admin.from('social_connections').select('network', { count: 'exact', head: true }).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
    supabase.from('strategies').select('id, data, created_at').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('posts').select('id, strategy_id, item_index, status, date, tema, rede, scheduled_at, published_at, external_url').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).limit(500),
  ]);
  const posts = (allPosts ?? []) as (WeekPost & { strategy_id: number })[];
  const answered = interview?.answers ? Object.keys(interview.answers as object).length : 0;
  // Quem já tem estratégia terminou a entrevista (mesmo que ela tenha ficado salva em outra versão).
  const interviewDone = !!interview?.completed_at || ctx.hasStrategy;

  // Primeiros passos: o objetivo é o primeiro post PUBLICADO (é aí que a pessoa sente o valor e cria o hábito).
  const firstOpen = [...posts].filter((p) => p.status !== 'publicado').sort((a, b) => a.date.localeCompare(b.date) || a.item_index - b.item_index)[0] ?? null;
  const steps = [
    { n: 1, title: 'Entrevista', desc: 'Conte quem você é, o que faz e onde quer chegar.', done: interviewDone, href: '/app/entrevista', cta: answered ? 'Continuar entrevista' : 'Começar entrevista' },
    { n: 2, title: 'Estratégia de 30 dias', desc: 'Pilares, série, calendário e plano de ação.', done: ctx.hasStrategy, href: ctx.hasStrategy ? '/app/estrategia' : '/app/entrevista', cta: 'Ver estratégia' },
    { n: 3, title: 'Primeiro post pronto', desc: 'Gere um post da sua semana ou crie o seu, com a sua foto.', done: posts.length > 0, href: posts.length ? '/app/conteudos' : '/app/conteudos/criar', cta: posts.length ? 'Ver meus posts' : 'Criar meu primeiro post' },
    // Publicar vem antes de conectar: o primeiro post pode ir ao ar copiando e colando; conectar é para automatizar.
    { n: 4, title: 'Primeiro post no ar', desc: 'Um clique copia o texto, baixa a imagem e abre o LinkedIn. Depois toque em “Publiquei”.', done: posts.some((p) => p.status === 'publicado' || p.status === 'agendado'), href: firstOpen ? `/app/conteudos/${firstOpen.id}#publicar` : '/app/conteudos', cta: 'Publicar meu primeiro post' },
    { n: 5, title: 'Publicar no automático', desc: 'Conecte o LinkedIn uma vez: você aprova e o 1loop publica no horário certo.', done: (networks ?? 0) > 0, href: '/app/redes', cta: 'Conectar o LinkedIn' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done) ?? null;
  const onboarding = !!nextStep;

  // ---------- Sua semana (segunda a domingo, horário de Brasília) ----------
  const today = isoInBrazil();
  const monday = addDays(today, -((fromISO(today).getDay() + 6) % 7));
  const sunday = addDays(monday, 6);
  const strategy = strategyRow?.data as Strategy | undefined;
  const start = strategyRow ? planStartFrom(strategyRow.created_at as string) : today;
  const byIndex = new Map(posts.filter((p) => p.strategy_id === strategyRow?.id).map((p) => [p.item_index, p]));
  const week = (strategy?.calendario ?? [])
    .map((it, index) => ({ it, index, date: itemDate(it, start), post: byIndex.get(index) ?? null }))
    .filter((x) => x.date >= monday && x.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date));
  const count = (st: string) => week.filter((w) => (w.post?.status ?? 'falta') === st).length;
  const nowIso = new Date().toISOString();
  const next = posts
    .filter((p) => (p.status === 'agendado' || p.status === 'publicando') && p.scheduled_at && p.scheduled_at >= nowIso)
    .sort((a, b) => (a.scheduled_at as string).localeCompare(b.scheduled_at as string))[0];
  const monthStart = `${today.slice(0, 8)}01`;
  const publishedMonth = posts.filter((p) => p.status === 'publicado' && p.published_at && isoInBrazil(new Date(p.published_at)) >= monthStart).length;
  const streak = streakOf(posts.filter((p) => p.status === 'publicado' && p.published_at).map((p) => p.published_at as string), today);
  const todayItem = week.find((w) => w.date === today) ?? null;
  const toReview = count('rascunho');
  const missing = count('falta');

  return (
    <div className="page">
      {assinou === '1' && !ctx.preview && (
        <>
          <TrackOnce id={`trial-${ctx.userId}`} ga="start_trial" meta="StartTrial" params={{ plan: ctx.plan, value: ctx.market === 'pt' ? EUR_PRICES[ctx.plan] : priceNow(ctx.plan), currency: currencyOf(ctx.market) }} />
          <div className="formNote rise" role="status">Pronto, {ctx.firstName}! Sua assinatura está confirmada. Seus posts continuam saindo no horário certo.</div>
        </>
      )}
      <div className="pageHead rise">
        <div className="eyebrow">Início</div>
        <h1 className="pageTitle">
          <span className="graphite">Olá,</span> <span className="grad">{ctx.firstName}.</span>
        </h1>
        {!onboarding && (
          <p className="pageSub">
            {toReview ? `${toReview} ${toReview === 1 ? 'post espera' : 'posts esperam'} sua revisão esta semana.` : missing ? `Faltam ${missing} ${missing === 1 ? 'post' : 'posts'} desta semana.` : 'Sua semana está pronta.'}
          </p>
        )}
      </div>

      {todayItem && interviewDone && (!onboarding || posts.length > 0) && (() => {
        const p = todayItem.post;
        const net = networkByName(todayItem.it.rede)?.id ?? 'linkedin';
        const st = p?.status ?? 'falta';
        const done = st === 'publicado';
        const sched = st === 'agendado' || st === 'publicando';
        const title = done ? 'Post de hoje no ar ✓' : sched ? `Sai hoje às ${new Date(p!.scheduled_at as string).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} ✓` : p ? 'Seu post de hoje está pronto' : 'Hoje tem post no seu plano';
        const sub = p?.tema || todayItem.it.tema;
        return (
          <section className={`card homeToday ${done || sched ? 'ok' : ''}`} aria-labelledby="h-hoje">
            <NetworkIcon id={net} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="eyebrow">Hoje · {todayItem.it.rede} · {todayItem.it.formato}</div>
              <div id="h-hoje" className="homeTodayTitle">{title}</div>
              <div className="muted homeEllipsis" style={{ fontSize: 14 }}>{sub}</div>
            </div>
            {done ? (
              p?.external_url ? <a className="btnGhost btnSm" href={p.external_url} target="_blank" rel="noopener noreferrer">Ver no {todayItem.it.rede}</a> : <Link className="btnGhost btnSm" href={`/app/conteudos/${p!.id}`}>Ver post</Link>
            ) : sched ? (
              <Link className="btnGhost btnSm" href={`/app/conteudos/${p!.id}`}>Ver post</Link>
            ) : p ? (
              <Link className="btn3d btnSm" href={`/app/conteudos/${p.id}${st === 'rascunho' ? '' : '#publicar'}`}>{st === 'rascunho' ? 'Revisar e publicar' : st === 'erro' ? 'Resolver' : 'Publicar agora'}</Link>
            ) : (
              <Link className="btn3d btnSm" href="/app/conteudos">Gerar o post de hoje</Link>
            )}
          </section>
        );
      })()}

      {onboarding && nextStep && (
        <section className="card homeNext" aria-labelledby="h-next">
          <div className="homeNextMain">
            <LoopMark size={40} stroke={1.4} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <div className="eyebrow">Próximo passo · {doneCount} de {steps.length}</div>
              <div id="h-next" style={{ fontSize: 22, fontWeight: 700 }}>{nextStep.title}</div>
              <div className="muted" style={{ fontSize: 15 }}>{nextStep.desc}</div>
            </div>
          </div>
          <Link className="btn3d" href={nextStep.href}>{nextStep.cta}</Link>
          <ol className="homeSteps">
            {steps.map((s) => (
              <li key={s.n} className={s.done ? 'done' : s === nextStep ? 'now' : ''}>
                <Link href={s.href}>
                  <span className="homeStepN" aria-hidden="true">{s.done ? '✓' : s.n}</span>
                  <span>{s.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {strategy && (
        <section className="homeWeek" aria-labelledby="h-semana">
          <div className="homeWeekHead">
            <h2 id="h-semana">Sua semana <span className="muted">{dm(monday)} a {dm(sunday)}</span></h2>
            <Link className="btnGhost btnSm" href="/app/conteudos">Abrir conteúdos</Link>
          </div>
          <div className="homeStats">
            <div className="card"><span className="muted">Posts na semana</span><b>{week.length}</b><span className="muted">{week.length - missing} {week.length - missing === 1 ? 'pronto' : 'prontos'}</span></div>
            <div className="card"><span className="muted">Para revisar</span><b>{toReview}</b><span className="muted">{count('aprovado') + count('agendado')} {count('aprovado') + count('agendado') === 1 ? 'aprovado' : 'aprovados'}</span></div>
            <div className="card"><span className="muted">Publicados no mês</span><b>{publishedMonth}</b><span className="muted">{count('publicado')} nesta semana</span></div>
            <div className="card"><span className="muted">Sequência</span><b>{streak} {streak === 1 ? 'semana' : 'semanas'}</b><span className="muted">{streak ? 'publicando sem parar' : 'publique 1 post para começar'}</span></div>
          </div>
          {next && (
            <Link href={`/app/conteudos/${next.id}`} className="card homeUpNext">
              <span className="eyebrow">Próxima publicação</span>
              <span className="homeUpNextRow">
                <NetworkIcon id={networkByName(next.rede)?.id ?? 'linkedin'} size={32} />
                <span style={{ minWidth: 0 }}>
                  <b>{when(next.scheduled_at as string)}</b>
                  <span className="muted homeEllipsis">{next.tema}</span>
                </span>
              </span>
            </Link>
          )}
          {week.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>Nenhum post desta semana no calendário. Veja os próximos em Conteúdos.</p>
          ) : (
            <ol className="homeDays">
              {week.map(({ it, index, date, post }) => {
                const st = STATUS[post?.status ?? 'falta'] ?? STATUS.falta;
                const net = networkByName(it.rede)?.id;
                return (
                  <li key={index} className={date === today ? 'today' : date < today ? 'past' : ''}>
                    <Link href={post ? `/app/conteudos/${post.id}` : '/app/conteudos'}>
                      <span className="homeDay"><span>{weekday(date)}</span><b>{Number(date.slice(8))}</b></span>
                      <span className="homeDayText">
                        <span className="muted homeDayMeta">{net && <NetworkIcon id={net} size={16} />}{it.rede} · {it.formato}</span>
                        <span className="homeEllipsis">{post?.tema || it.tema}</span>
                      </span>
                      <span className={`homeChip ${st.cls}`}>{st.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      <section aria-label="Atalhos" className="homeQuick">
        <Link href="/app/conteudos/criar" className="card">
          <b>Crie seu post</b>
          <span className="muted">Sua foto, sua legenda e uma IA para pedir o que quiser.</span>
        </Link>
        <Link href="/app/conteudos/novo" className="card">
          <b>Contar uma história</b>
          <span className="muted">Fale 1 minuto sobre algo do seu dia. O 1loop transforma em post.</span>
        </Link>
        <Link href="/app/comentarios" className="card">
          <b>Comentar em posts</b>
          <span className="muted">Cole o post de um cliente e receba 3 comentários na sua voz.</span>
        </Link>
        <Link href="/app/estrategia" className="card">
          <b>Sua estratégia</b>
          <span className="muted">Pilares, série e calendário do mês.</span>
        </Link>
        <Link href="/app/contexto" className="card">
          <b>Contexto e IAs</b>
          <span className="muted">Seus números e cases viram base dos posts. Conecte o Claude ou o ChatGPT.</span>
        </Link>
      </section>
    </div>
  );
}
