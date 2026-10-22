import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { sanitizeAnswers } from '@/lib/interview';
import { Interview } from '@/components/Interview';

export const metadata = { title: 'Entrevista · 1loop creators' };

export default async function EntrevistaPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string }> }) {
  const { bemvindo } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase.from('interviews').select('answers').eq('user_id', ctx.userId).maybeSingle();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100 }}>
      {bemvindo && (
        <div className="formNote rise" role="status">
          Pronto, {ctx.firstName}! Seu teste de 7 dias começou. O primeiro passo é a entrevista: leva uns 10 minutos.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Passo 1 · Entrevista</div>
        <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
          <span className="graphite">{ctx.firstName}, vamos conhecer você.</span>
        </h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 680 }}>
          Suas respostas viram o seu perfil de voz e a base da sua estratégia de 30 dias. Elas ficam salvas a cada passo.
        </p>
      </div>
      <Interview initial={sanitizeAnswers(data?.answers)} hasStrategy={ctx.hasStrategy} />
    </div>
  );
}
