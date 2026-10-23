import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { sanitizeAnswers } from '@/lib/interview';
import { Interview } from '@/components/Interview';
import { TrackOnce } from '@/components/Tracking';
import { PLANS } from '@/lib/plans';

export const metadata = { title: 'Entrevista · 1loop creators' };

export default async function EntrevistaPage({ searchParams }: { searchParams: Promise<{ bemvindo?: string; assinou?: string }> }) {
  const { bemvindo, assinou } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  // No Multi, a entrevista é da marca em uso.
  const brandMode = ctx.brands.length > 1 && ctx.brandName.trim().toLowerCase() !== ctx.name.trim().toLowerCase();
  const { data } = await supabase.from('interviews').select('answers').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle();

  return (
    <div className="page">
      {bemvindo && assinou === '1' && (
        <TrackOnce
          id={`trial-${ctx.userId}`}
          ga="start_trial"
          meta="StartTrial"
          params={{ plan: ctx.plan, value: PLANS[ctx.plan].priceFounders ?? PLANS[ctx.plan].priceFull, currency: 'BRL' }}
        />
      )}
      {bemvindo && (
        <div className="formNote rise" role="status">
          Pronto, {ctx.firstName}! Seu teste de 7 dias começou. O primeiro passo é a entrevista: leva uns 10 minutos.
        </div>
      )}
      <div className="pageHead">
        <div className="eyebrow">Entrevista</div>
        <h1 className="pageTitle">
          <span className="graphite">{brandMode ? `Vamos conhecer a marca ${ctx.brandName}.` : `${ctx.firstName}, vamos conhecer você.`}</span>
        </h1>
        <p className="pageSub">{brandMode ? 'Responda pensando nesta marca. Tudo fica salvo.' : 'Leva uns 10 minutos. Tudo fica salvo a cada passo.'}</p>
      </div>
      <Interview initial={sanitizeAnswers(data?.answers)} hasStrategy={ctx.hasStrategy} />
    </div>
  );
}
