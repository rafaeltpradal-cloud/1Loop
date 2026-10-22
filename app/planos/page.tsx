import Link from 'next/link';
import { PublicShell, Steps } from '@/components/PublicShell';
import { PLANS, brl, type PlanId } from '@/lib/plans';

export const metadata = { title: 'Planos · 1loop creators' };

const ORDER: PlanId[] = ['basic', 'pro', 'multi'];

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ assinatura?: string }> }) {
  const { assinatura } = await searchParams;
  return (
    <PublicShell right={<Link className="btnGhost btnSm" href="/entrar">Entrar</Link>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <Steps current={1} />
        <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
          <div className="eyebrow">Escolha seu plano</div>
          <h1 style={{ fontSize: 'clamp(30px, 4vw, 46px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
            <span className="graphite">Teste 7 dias.</span> <span className="grad">Cancele quando quiser.</span>
          </h1>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>Estratégia completa em todos os planos. A diferença é o ritmo e, no Pro e no Multi, o editor visual das imagens. O cartão é pedido agora, mas a primeira cobrança só acontece depois do teste.</p>
        </div>
        {assinatura === 'pendente' && (
          <div className="formNote" role="status">Sua conta está criada, mas a assinatura ainda não foi ativada. Escolha um plano para começar o teste.</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {ORDER.map((id) => {
            const p = PLANS[id];
            const featured = id === 'pro';
            return (
              <div key={id} className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 18, ...(featured ? { borderColor: 'var(--ink)', boxShadow: '0 0 0 2px var(--ink), 0 30px 60px rgba(14,15,18,.12)' } : {}) }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{p.name}</div>
                  <div className="muted" style={{ fontSize: 14 }}>{p.tagline}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  {p.priceFounders && <s style={{ fontSize: 17, fontWeight: 600, color: 'var(--muted-2)' }}>{brl(p.priceFull)}</s>}
                  <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-1px' }}>{brl(p.priceFounders ?? p.priceFull)}</span>
                  <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>/mês</span>
                </div>
                <div className="panel" style={{ padding: '14px 16px', fontWeight: 700, fontSize: 14 }}>{p.rhythm}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                  {p.features.map((f) => (
                    <li key={f} style={{ display: 'flex', gap: 10 }}><span style={{ color: 'var(--teal)', fontWeight: 800 }}>✓</span>{f}</li>
                  ))}
                </ul>
                <div style={{ flex: 1 }} />
                <Link className={featured ? 'btn3d' : 'btnGhost'} href={`/cadastro?plano=${id}`}>Testar 7 dias o {p.name}</Link>
              </div>
            );
          })}
        </div>
      </div>
    </PublicShell>
  );
}
