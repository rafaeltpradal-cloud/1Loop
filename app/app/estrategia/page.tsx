import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { StrategyView } from '@/components/StrategyView';
import { RegenerateButton } from '@/components/RegenerateButton';
import { StrategyAi } from '@/components/StrategyAi';
import { PLANS } from '@/lib/plans';
import { getUsage } from '@/lib/usage';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Strategy } from '@/lib/strategy';
import { isoInBrazil, planStartFrom } from '@/lib/dates';

export const metadata = { title: 'Estratégia · 1loop creators' };

export default async function EstrategiaPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  // Começa a contar o uso do mês junto com as outras buscas.
  const usageP = getUsage(createAdminClient(), ctx.userId, ctx.brandId, ctx.plan);
  const { data } = await supabase
    .from('strategies')
    .select('id, data, source, created_at')
    .eq('user_id', ctx.userId).eq('brand_id', ctx.brandId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">Estratégia</div>
        <h1 className="pageTitle"><span className="graphite">Sua estratégia nasce da entrevista.</span></h1>
        <p className="pageSub">Responda a entrevista e o plano de 30 dias sai em seguida.</p>
        <div><Link className="btn3d" href="/app/entrevista">Fazer a entrevista</Link></div>
      </div>
    );
  }

  const usage = await usageP;
  const created = new Date(data.created_at as string);
  // O plano começa no dia seguinte ao que foi gerado (horário de Brasília).
  const start = planStartFrom(created);
  const today = isoInBrazil();

  return (
    <div className="page">
      <div className="pageHeadRow">
        <div className="pageHead">
          <div className="eyebrow">Estratégia</div>
          <h1 className="pageTitle">
            <span className="graphite">Seu plano de</span> <span className="grad">30 dias.</span>
          </h1>
          <span className="pageSub">
            Gerado em {created.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            {data.source === 'demo' && ' · modo demonstração (configure a chave da IA para a versão completa)'}
          </span>
        </div>
        <div className="pageActions">
          <Link className="btnGhost btnSm" href="/app/entrevista">Ajustar respostas</Link>
          <RegenerateButton left={usage.strategies.max - usage.strategies.used} max={usage.strategies.max} month={usage.month} nextMonth={usage.nextMonth} />
          <Link className="btn3d btnSm" href="/app/redes">Avançar →</Link>
        </div>
      </div>
      <StrategyAi
        key={Number(data.id)}
        left={PLANS[ctx.plan].strategyAdjusts - ((data.data as Strategy).ajustes ?? 0)}
        max={PLANS[ctx.plan].strategyAdjusts}
        canUndo={!!(data.data as Strategy).anterior}
      />
      <StrategyView s={{ ...(data.data as Strategy), anterior: undefined }} strategyId={Number(data.id)} start={start} today={today} />
      <div className="nextRow">
        <span>Próximo passo: <b>conectar as redes</b></span>
        <Link className="btn3d btnSm" href="/app/redes">Avançar →</Link>
      </div>
    </div>
  );
}
