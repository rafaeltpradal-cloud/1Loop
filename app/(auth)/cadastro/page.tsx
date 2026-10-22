import Link from 'next/link';
import { PublicShell, Steps } from '@/components/PublicShell';
import { PLANS, brl, isPlanId } from '@/lib/plans';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: 'Criar conta · 1loop creators' };

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = PLANS[isPlanId(plano) ? plano : 'pro'];

  return (
    <PublicShell right={<span className="muted" style={{ fontSize: 14 }}>Já tem conta? <Link href="/entrar">Entrar</Link></span>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start' }}>
        <div style={{ flex: '999 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Steps current={2} />
          <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
              <span className="graphite">Crie sua conta.</span> <span className="grad">Leva 1 minuto.</span>
            </h1>
            <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>Depois do cadastro você vai para o pagamento seguro do Stripe e já começa seus 7 dias de teste.</p>
          </div>
          <SignUpForm plan={plan.id} />
        </div>

        <aside className="card" style={{ flex: '1 1 300px', minWidth: 0, padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="eyebrow">Seu plano</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{plan.name}</div>
            <div style={{ fontWeight: 700 }}>{brl(plan.priceFounders ?? plan.priceFull)}<span className="muted" style={{ fontWeight: 600 }}>/mês</span></div>
          </div>
          <div className="panel" style={{ padding: '12px 14px', fontSize: 14, fontWeight: 700 }}>{plan.rhythm}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
            <li>✓ 7 dias para testar</li>
            <li>✓ Nenhuma cobrança antes do fim do teste</li>
            <li>✓ Cancele quando quiser</li>
          </ul>
          <Link className="linkBtn" href="/planos">Trocar de plano</Link>
        </aside>
      </div>
    </PublicShell>
  );
}
