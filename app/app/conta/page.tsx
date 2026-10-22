import { getAppContext } from '@/lib/session';
import { PLANS, brl } from '@/lib/plans';

export const metadata = { title: 'Conta · 1loop creators' };

const STATUS: Record<string, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
};

export default async function ContaPage() {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 38px)', letterSpacing: '-1px' }}><span className="graphite">Conta e plano</span></h1>
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Plano</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>{plan.name} · {brl(plan.priceFounders ?? plan.priceFull)}/mês</div>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{plan.rhythm}</div>
          </div>
          <span className="pill" style={{ alignSelf: 'flex-start' }}>
            <span className="dot" style={{ background: ctx.status === 'past_due' ? 'var(--amber)' : 'var(--teal)' }} />
            {STATUS[ctx.status] ?? ctx.status}
            {ctx.trialDaysLeft !== null && ` · ${ctx.trialDaysLeft} dias`}
          </span>
        </div>
        <form action="/api/stripe/portal" method="post">
          <button className="btnGhost" type="submit">Gerenciar assinatura e cartão</button>
        </form>
        <p className="muted" style={{ fontSize: 13 }}>Você é levado para o portal seguro do Stripe para trocar de plano, atualizar o cartão ou cancelar.</p>
      </div>
      <div className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="eyebrow">Dados</div>
        <div style={{ fontWeight: 700 }}>{ctx.name}</div>
        <div className="muted">{ctx.email}</div>
      </div>
    </div>
  );
}
