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

// Tópico que abre e fecha ao clicar.
function Topic({ title, summary, icon, children }: { title: string; summary: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="card topic">
      <summary>
        <span className="topicIcon" aria-hidden="true">{icon}</span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{title}</span>
          <span className="muted" style={{ fontSize: 13 }}>{summary}</span>
        </span>
        <svg className="topicChevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="topicBody">{children}</div>
    </details>
  );
}

const ic = (d: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

export default async function ConfiguracoesPage() {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];

  return (
    <div className="page">
      <div className="pageHeadRow">
        <div className="pageHead">
          <div className="eyebrow">Conta</div>
          <h1 className="pageTitle"><span className="graphite">Configurações</span></h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Tema</span>
          <ThemeSwitcher compact />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Topic
          title="Plano e pagamento"
          summary={`${plan.name} · ${STATUS[ctx.status] ?? ctx.status}${ctx.trialDaysLeft !== null ? ` · ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia' : 'dias'}` : ''}`}
          icon={ic(<><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>)}
        >
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
        </Topic>

        <Topic
          title="Privacidade"
          summary="Senha e seus dados"
          icon={ic(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 style={{ fontSize: 15 }}>Trocar senha</h3>
            <p className="muted" style={{ fontSize: 13 }}>Você entra com {ctx.email}. Para trocar, confirme a senha atual.</p>
          </div>
          <PasswordForm />
          <hr className="divider" />
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13, fontWeight: 600 }}>
            <a href="/privacidade" target="_blank" rel="noopener">Política de privacidade</a>
            <a href="/termos" target="_blank" rel="noopener">Termos de uso</a>
          </div>
        </Topic>

        <Topic title="Sessão" summary="Sair da conta neste aparelho" icon={ic(<><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5M15 12H3" /></>)}>
          <form action="/auth/sair" method="post">
            <button className="btnGhost btnSm" type="submit">Sair da conta</button>
          </form>
        </Topic>
      </div>
    </div>
  );
}
