import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { StrategyView } from '@/components/StrategyView';
import { RegenerateButton } from '@/components/RegenerateButton';
import type { Strategy } from '@/lib/strategy';

export const metadata = { title: 'Estratégia · 1loop creators' };

export default async function EstrategiaPage() {
  const ctx = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from('strategies')
    .select('data, source, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return (
      <div className="card" style={{ padding: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="eyebrow">Estratégia</div>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.8px' }}><span className="graphite">Sua estratégia nasce da entrevista.</span></h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>Responda as perguntas e a ferramenta monta seu plano de 30 dias: pilares, série, calendário e plano de ação.</p>
        <div><Link className="btn3d" href="/app/entrevista">Fazer a entrevista</Link></div>
      </div>
    );
  }

  const created = new Date(data.created_at as string);
  const start = new Date(created);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="eyebrow">Passo 2 · Sua estratégia</div>
          <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
            <span className="graphite">Seu plano de</span> <span className="grad">30 dias.</span>
          </h1>
          <span className="muted" style={{ fontSize: 13 }}>
            Gerado em {created.toLocaleDateString('pt-BR')}
            {data.source === 'demo' && ' · modo demonstração (configure a chave da IA para a versão completa)'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btnGhost btnSm" href="/app/entrevista">Ajustar respostas</Link>
          <RegenerateButton />
        </div>
      </div>
      <StrategyView s={data.data as Strategy} startDate={start} />
    </div>
  );
}
