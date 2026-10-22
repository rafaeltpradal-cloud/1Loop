import Link from 'next/link';
import { Brand, LoopMark, Wordmark } from '@/components/Logo';
import { AppNav } from '@/components/AppNav';
import { Avatar } from '@/components/Avatar';
import { getAppContext } from '@/lib/session';
import { PLANS } from '@/lib/plans';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];

  return (
    <div className="shell">
      {/* Celular: barra de cima com marca, configurações e perfil */}
      <header className="mobileBar">
        <Link href="/app" aria-label="1loop creators — início" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', minHeight: 44 }}>
          <LoopMark size={30} />
          <Wordmark size={18} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/app/plano" className="mobilePlan">
            <span className="dot" style={{ background: ctx.status === 'trialing' ? 'var(--violet)' : 'var(--teal)' }} />
            {plan.name}
          </Link>
          <Link href="/app/configuracoes" className="mobileIconBtn" aria-label="Configurações">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </Link>
          <Link href="/app/perfil" aria-label="Seu perfil" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>
            <Avatar name={ctx.name} url={ctx.avatarUrl} size={34} />
          </Link>
        </div>
      </header>

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
      <AppNav group="tabs" />
    </div>
  );
}
