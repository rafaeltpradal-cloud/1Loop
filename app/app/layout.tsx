import Link from 'next/link';
import { Brand } from '@/components/Logo';
import { AppNav } from '@/components/AppNav';
import { Avatar } from '@/components/Avatar';
import { getAppContext } from '@/lib/session';
import { PLANS } from '@/lib/plans';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand href="/app" />
        <AppNav group="main" />
        <div className="sidebarFoot">
          <AppNav group="account" />
          <Link href="/app/plano" className="card planCard footExtra" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'none', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
              <span className="dot" style={{ background: ctx.status === 'trialing' ? 'var(--violet)' : 'var(--teal)' }} />
              Plano {plan.name}
              <span className="planCardGo" aria-hidden="true">›</span>
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              {ctx.trialDaysLeft !== null ? `Teste: ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}` : plan.rhythm}
              {ctx.plan !== 'multi' ? ' · fazer upgrade' : ''}
            </span>
          </Link>
          <div className="footExtra" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Link href="/app/perfil" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
              <Avatar name={ctx.name} url={ctx.avatarUrl} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.name}</span>
                <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.email}</span>
              </span>
            </Link>
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
