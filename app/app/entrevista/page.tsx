import { getPreviewContext as getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { QUICK_DEFAULTS, QUICK_QUESTIONS, sanitizeAnswers } from '@/lib/interview';
import { Interview } from '@/components/Interview';
import { TrackOnce } from '@/components/Tracking';
import { priceNow } from '@/lib/founders';

export const metadata = { title: 'Entrevista · 1loop creators' };

export default async function EntrevistaPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string; assinou?: string; completa?: string }> }) {
  const { bemvindo, assinou, completa } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  // No Multi, a entrevista é da marca em uso.
  const brandMode = ctx.brands.length > 1 && ctx.brandName.trim().toLowerCase() !== ctx.name.trim().toLowerCase();
  const { data } = await supabase.from('interviews').select('answers').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle();
  // Primeira vez: começo rápido (5 perguntas). Depois do primeiro post, a entrevista completa afina a estratégia.
  const quick = !ctx.hasStrategy && completa !== '1';
  const saved = sanitizeAnswers(data?.answers);
  const initial = quick && !saved.redes ? { ...saved, redes: ['LinkedIn'] } : saved;

  return (
    <div className="page">
      {bemvindo && assinou === '1' && (
        <TrackOnce
          id={`trial-${ctx.userId}`}
          ga="start_trial"
          meta="StartTrial"
          params={{ plan: ctx.plan, value: priceNow(ctx.plan), currency: 'BRL' }}
        />
      )}
      {bemvindo && ctx.preview && (
        <TrackOnce id={`signup-${ctx.userId}`} ga="sign_up" meta="CompleteRegistration" params={{ plan: ctx.plan, value: priceNow(ctx.plan), currency: 'BRL' }} />
      )}
      {bemvindo && (
        <div className="formNote rise" role="status">
          {ctx.preview
            ? `Conta criada, ${ctx.firstName}! São só 5 perguntas: em 2 minutos sai sua estratégia de 30 dias e seu primeiro post.`
            : `Pronto, ${ctx.firstName}! Seu teste de 7 dias começou. O primeiro passo é a entrevista: leva uns 10 minutos.`}
        </div>
      )}
      <div className="pageHead">
        <div className="eyebrow">Entrevista</div>
        <h1 className="pageTitle">
          <span className="graphite">{brandMode ? `Vamos conhecer a marca ${ctx.brandName}.` : `${ctx.firstName}, vamos conhecer você.`}</span>
        </h1>
        <p className="pageSub">{quick ? '5 perguntas rápidas, uns 2 minutos. Depois você pode responder mais para afinar.' : brandMode ? 'Responda pensando nesta marca. Tudo fica salvo.' : 'Mais algumas perguntas para a estratégia ficar ainda mais a sua cara. Tudo fica salvo.'}</p>
      </div>
      <Interview initial={initial} hasStrategy={ctx.hasStrategy} preview={ctx.preview} firstName={ctx.firstName} {...(quick ? { questions: QUICK_QUESTIONS, defaults: QUICK_DEFAULTS } : {})} />
    </div>
  );
}
