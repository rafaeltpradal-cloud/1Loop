import { getAppContext } from '@/lib/session';
import { stripe } from '@/lib/stripe';
import { recordExtraPack } from '@/lib/billing';
import { EXTRA_PACK, PLANS, brl } from '@/lib/plans';
import { PlanCards } from './PlanCards';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUsage } from '@/lib/usage';

export const metadata = { title: 'Plano · 1loop creators' };

const STATUS: Record<string, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
};

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ pacote?: string }> }) {
  const ctx = await getAppContext();
  const { pacote } = await searchParams;

  // Volta do pagamento do pacote: confirma com o Stripe e registra (caso o webhook ainda não tenha chegado).
  let bought = false;
  if (pacote && pacote.startsWith('cs_')) {
    try {
      const session = await stripe().checkout.sessions.retrieve(pacote);
      if (session.client_reference_id === ctx.userId) bought = await recordExtraPack(session);
    } catch (err) {
      console.error('[pacote]', err);
    }
  }

  const usage = await getUsage(createAdminClient(), ctx.userId, ctx.brandId, ctx.plan);
  const extras = usage.extras.available;
  const plan = PLANS[ctx.plan];
  const meter = (label: string, used: number, max: number) => (
    <div className="usageItem">
      <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <b>{label}</b>
        <span className="muted">{Math.min(used, max)} de {max}</span>
      </span>
      <span className="progress" aria-hidden="true"><span style={{ width: `${Math.min(100, (used / Math.max(1, max)) * 100)}%` }} /></span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1080 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Plano</div>
        <h1 className="pageTitle">
          <span className="graphite">Seu plano é o</span> <span className="grad">{plan.name}.</span>
        </h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill">
            <span className="dot" style={{ background: ctx.status === 'past_due' ? 'var(--amber)' : ctx.status === 'trialing' ? 'var(--violet)' : 'var(--teal)' }} />
            {STATUS[ctx.status] ?? ctx.status}
            {ctx.trialDaysLeft !== null && ` · ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}`}
          </span>
          <span className="pill">{plan.rhythm}</span>
          {extras > 0 && <span className="pill">+{extras} posts extras</span>}
        </div>
      </div>

      <section aria-labelledby="h-uso" className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <h2 id="h-uso" style={{ fontSize: 18 }}>Uso de {usage.month}{ctx.brands.length > 1 ? ` · ${ctx.brandName}` : ''}</h2>
          <span className="muted" style={{ fontSize: 13 }}>Renova em 1º de {usage.nextMonth}</span>
        </div>
        <div className="usageGrid">
          {meter('Estratégias novas', usage.strategies.used, usage.strategies.max)}
          {meter('Posts novos', usage.posts.used, usage.posts.max)}
        </div>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.55 }}>
          Cada post pode ser refeito {plan.refacoes} vezes e ajustado {plan.postAdjusts} vezes com a IA; cada estratégia, ajustada {plan.strategyAdjusts} vezes.
          {ctx.plan === 'multi' ? ' No Multi, as cotas valem para cada marca.' : ''}
          {extras > 0 ? ` Você ainda tem ${extras} posts extras de pacote, que não vencem.` : ''}
        </span>
      </section>

      {bought && <div className="formOk" role="status">Pacote comprado! {EXTRA_PACK.posts} posts extras foram somados à sua conta.</div>}

      <section aria-labelledby="h-planos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="h-planos" style={{ fontSize: 18 }}>Mudar de plano</h2>
        <PlanCards current={ctx.plan} trialing={ctx.status === 'trialing'} />
      </section>

      <section aria-labelledby="h-pacote" className="card" style={{ padding: 26, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '999 1 380px', minWidth: 0 }}>
          <div className="eyebrow">Pacote extra</div>
          <h2 id="h-pacote" style={{ fontSize: 22 }}>+{EXTRA_PACK.posts} posts avulsos por {brl(EXTRA_PACK.price)}</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            Para uma campanha, um lançamento ou quando os posts do mês acabarem. Pagamento único, sem mudar seu plano, e os posts extras não vencem.
            {extras > 0 ? ` Você tem ${extras} posts extras disponíveis.` : ''}
          </p>
        </div>
        <form action="/api/pacote" method="post">
          <button className="btnGhost" type="submit">Comprar pacote</button>
        </form>
      </section>

      <div className="card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', boxShadow: 'none' }}>
        <span className="muted" style={{ fontSize: 14 }}>Cartão, faturas e cancelamento ficam no portal seguro do Stripe.</span>
        <form action="/api/stripe/portal" method="post">
          <button className="linkBtn" type="submit" style={{ fontSize: 13 }}>Gerenciar pagamento</button>
        </form>
      </div>
    </div>
  );
}
