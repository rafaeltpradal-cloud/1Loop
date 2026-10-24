import Link from 'next/link';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { LoopMark } from '@/components/Logo';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrackOnce } from '@/components/Tracking';
import { priceNow } from '@/lib/founders';
import { PREVIEW } from '@/lib/access';

export const metadata = { title: 'Início · 1loop creators' };

export default async function AppHome({ searchParams }: { searchParams: Promise<{ assinou?: string }> }) {
  const { assinou } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data: interview }, { count: networks }, { count: posts }] = await Promise.all([
    supabase.from('interviews').select('answers, completed_at').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle(),
    // Conta como feito só com a publicação automática conectada (LinkedIn ou Instagram).
    createAdminClient().from('social_connections').select('network', { count: 'exact', head: true }).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
  ]);
  const answered = interview?.answers ? Object.keys(interview.answers as object).length : 0;

  const steps = ctx.preview
    ? [
        { n: 1, title: 'Entrevista', desc: 'Conte quem você é, o que vende e para quem.', done: !!interview?.completed_at, href: '/app/entrevista', cta: answered ? 'Continuar entrevista' : 'Começar entrevista', soon: false },
        { n: 2, title: 'Estratégia de 30 dias', desc: 'Pilares, série, calendário e plano de ação.', done: ctx.hasStrategy, href: ctx.hasStrategy ? '/app/estrategia' : '/app/entrevista', cta: 'Ver estratégia', soon: false },
        { n: 3, title: 'Seus primeiros posts', desc: `Até ${PREVIEW.posts} posts prontos, grátis e sem cartão.`, done: (posts ?? 0) >= PREVIEW.posts, href: '/app/conteudos', cta: (posts ?? 0) > 0 ? 'Ver meus posts' : 'Gerar meus posts', soon: false },
        { n: 4, title: 'Começar 7 dias grátis', desc: 'Publicação automática e o mês inteiro de posts.', done: false, href: '/app/assinar', cta: 'Começar 7 dias grátis', soon: false },
      ]
    : [
    { n: 1, title: 'Entrevista', desc: 'Conte quem você é, o que vende e para quem.', done: !!interview?.completed_at, href: '/app/entrevista', cta: answered ? 'Continuar entrevista' : 'Começar entrevista', soon: false },
    { n: 2, title: 'Estratégia de 30 dias', desc: 'Pilares, série, calendário e plano de ação.', done: ctx.hasStrategy, href: '/app/estrategia', cta: 'Ver estratégia', soon: false },
    { n: 3, title: 'Conectar redes', desc: 'Conecte LinkedIn ou Instagram para publicar sozinho.', done: (networks ?? 0) > 0, href: '/app/redes', cta: 'Conectar redes', soon: false },
    { n: 4, title: 'Conteúdos da semana', desc: 'Lotes prontos para aprovar e publicar.', done: (posts ?? 0) > 0, href: '/app/conteudos', cta: 'Gerar conteúdos', soon: false },
      ];
  const nextStep = steps.find((s) => !s.done) ?? steps[0];

  return (
    <div className="page">
      {assinou === '1' && !ctx.preview && (
        <>
          <TrackOnce id={`trial-${ctx.userId}`} ga="start_trial" meta="StartTrial" params={{ plan: ctx.plan, value: priceNow(ctx.plan), currency: 'BRL' }} />
          <div className="formNote rise" role="status">Pronto, {ctx.firstName}! Seu teste de 7 dias começou. Conecte o LinkedIn e o primeiro post já pode sair hoje.</div>
        </>
      )}
      <div className="pageHead rise">
        <div className="eyebrow">Início</div>
        <h1 className="pageTitle">
          <span className="graphite">Olá,</span> <span className="grad">{ctx.firstName}.</span>
        </h1>
      </div>

      <div className="card" style={{ padding: 28, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flex: '999 1 420px', minWidth: 0 }}>
          <LoopMark size={40} stroke={1.4} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="eyebrow">Próximo passo</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{nextStep.title}</div>
            <div className="muted" style={{ fontSize: 15 }}>{nextStep.desc}</div>
          </div>
        </div>
        {!nextStep.soon && <Link className="btn3d" href={nextStep.href}>{nextStep.cta}</Link>}
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {steps.map((s) => (
          <li key={s.n}>
            <Link href={s.href} className="card" style={{ height: '100%', padding: 22, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: 'none', opacity: s.soon ? 0.75 : 1, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, background: s.done ? 'var(--done-bg)' : 'var(--hover)', color: s.done ? 'var(--done-ink)' : 'var(--muted)' }}>{s.done ? '✓' : s.n}</span>
                {s.soon && <span className="eyebrow" style={{ fontSize: 10 }}>Em breve</span>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{s.title}</div>
              <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{s.desc}</div>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
