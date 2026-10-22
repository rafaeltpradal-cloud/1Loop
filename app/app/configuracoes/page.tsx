import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { PLANS, brl } from '@/lib/plans';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { PasswordForm } from './PasswordForm';

export const metadata = { title: 'Configurações · 1loop creators' };

const STATUS: Record<string, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
};

function Section({ id, title, desc, children }: { id: string; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card" aria-labelledby={id} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 id={id} style={{ fontSize: 18 }}>{title}</h2>
        {desc && <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{desc}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function ConfiguracoesPage() {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Conta</div>
        <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 38px)', letterSpacing: '-1px' }}><span className="graphite">Configurações</span></h1>
      </div>

      <Section id="h-plano" title="Plano e pagamento">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{plan.name} · {brl(plan.priceFounders ?? plan.priceFull)}/mês</div>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{plan.rhythm}</div>
          </div>
          <span className="pill" style={{ alignSelf: 'flex-start' }}>
            <span className="dot" style={{ background: ctx.status === 'past_due' ? 'var(--amber)' : 'var(--teal)' }} />
            {STATUS[ctx.status] ?? ctx.status}
            {ctx.trialDaysLeft !== null && ` · ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia' : 'dias'}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn3d btnSm" href="/app/plano">Ver planos e pacotes</Link>
          <form action="/api/stripe/portal" method="post">
            <button className="btnGhost btnSm" type="submit">Gerenciar assinatura e cartão</button>
          </form>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>Você vai para o portal seguro do Stripe para trocar de plano, atualizar o cartão, ver faturas ou cancelar.</p>
      </Section>

      <Section id="h-seguranca" title="Senha" desc={`Você entra com ${ctx.email}.`}>
        <PasswordForm />
      </Section>

      <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', boxShadow: 'none' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Tema</span>
        <ThemeSwitcher compact />
      </div>

      <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', boxShadow: 'none' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Sessão</span>
        <form action="/auth/sair" method="post">
          <button className="linkBtn" type="submit" style={{ fontSize: 13 }}>Sair da conta</button>
        </form>
      </div>
    </div>
  );
}
