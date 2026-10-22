import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { QUESTIONS, displayValue, type Answers } from '@/lib/interview';
import { ProfileForm } from './ProfileForm';

export const metadata = { title: 'Perfil · 1loop creators' };

const SUMMARY = ['sobre', 'oferta', 'publico', 'temas', 'redes', 'tom'];

export default async function PerfilPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data: profile }, { data: interview }] = await Promise.all([
    supabase.from('profiles').select('name, phone').eq('id', ctx.userId).maybeSingle(),
    supabase.from('interviews').select('answers').eq('user_id', ctx.userId).maybeSingle(),
  ]);
  const answers = (interview?.answers ?? {}) as Answers;
  const initials = ctx.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span className="avatar" style={{ width: 64, height: 64, fontSize: 22 }} aria-hidden="true">{initials}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div className="eyebrow">Perfil</div>
          <h1 style={{ fontSize: 'clamp(26px, 3.2vw, 36px)', letterSpacing: '-1px' }}><span className="graphite">{ctx.name}</span></h1>
        </div>
      </div>

      <section className="card" aria-labelledby="h-dados" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 id="h-dados" style={{ fontSize: 18 }}>Seus dados</h2>
        <ProfileForm name={(profile?.name as string) || ctx.name} phone={(profile?.phone as string) || ''} email={ctx.email} />
      </section>

      <section className="card" aria-labelledby="h-marca" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h2 id="h-marca" style={{ fontSize: 18 }}>Perfil de marca</h2>
          <Link className="btnGhost btnSm" href="/app/entrevista">Editar respostas</Link>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>É o que a ferramenta usa para montar sua estratégia e seus conteúdos.</p>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {QUESTIONS.filter((q) => SUMMARY.includes(q.id)).map((q) => {
            const txt = displayValue(q, answers);
            return (
              <div key={q.id} className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <dt style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>{q.title}</dt>
                <dd style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: txt ? 'var(--ink)' : 'var(--muted-2)' }}>{txt || 'Ainda não respondido'}</dd>
              </div>
            );
          })}
        </dl>
      </section>
    </div>
  );
}
