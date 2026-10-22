import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { LoopMark } from '@/components/Logo';

export const metadata = { title: 'Início · 1loop creators' };

export default async function AppHome() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data: interview }, { count: networks }] = await Promise.all([
    supabase.from('interviews').select('answers, completed_at').eq('user_id', ctx.userId).maybeSingle(),
    supabase.from('social_accounts').select('id', { count: 'exact', head: true }).eq('user_id', ctx.userId),
  ]);
  const answered = interview?.answers ? Object.keys(interview.answers as object).length : 0;

  const steps = [
    { n: 1, title: 'Entrevista', desc: 'Conte quem você é, o que vende e para quem.', done: !!interview?.completed_at, href: '/app/entrevista', cta: answered ? 'Continuar entrevista' : 'Começar entrevista', soon: false },
    { n: 2, title: 'Estratégia de 30 dias', desc: 'Pilares, série, calendário e plano de ação.', done: ctx.hasStrategy, href: '/app/estrategia', cta: 'Ver estratégia', soon: false },
    { n: 3, title: 'Conectar redes', desc: 'Cadastre os perfis onde seus conteúdos vão sair.', done: (networks ?? 0) > 0, href: '/app/redes', cta: 'Cadastrar redes', soon: false },
    { n: 4, title: 'Conteúdos da semana', desc: 'Lotes prontos para aprovar e publicar.', done: false, href: '/app/conteudos', cta: 'Em breve', soon: true },
  ];
  const nextStep = steps.find((s) => !s.done) ?? steps[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1040 }}>
      <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Início</div>
        <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
          <span className="graphite">Olá, {ctx.firstName}.</span> <span className="grad">Vamos colocar seu conteúdo em loop.</span>
        </h1>
      </div>

      <div className="card" style={{ padding: 28, display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flex: '999 1 420px', minWidth: 0 }}>
          <LoopMark size={64} stroke={1.4} />
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
