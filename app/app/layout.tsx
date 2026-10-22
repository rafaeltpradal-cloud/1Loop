import { Brand } from '@/components/Logo';
import { AppNav } from '@/components/AppNav';
import { getAppContext } from '@/lib/session';
import { PLANS } from '@/lib/plans';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand href="/app" />
        <AppNav />
        <div className="sidebarFoot" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
              <span className="dot" style={{ background: ctx.status === 'trialing' ? 'var(--violet)' : 'var(--teal)' }} />
              Plano {plan.name}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              {ctx.trialDaysLeft !== null ? `Teste: ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}` : plan.rhythm}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.name}</span>
            <form action="/auth/sair" method="post">
              <button className="linkBtn" type="submit" style={{ fontSize: 13 }}>Sair</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
