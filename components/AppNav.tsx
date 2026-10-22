'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; icon: React.ReactNode; soon?: boolean };

const ic = (d: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const MAIN: Item[] = [
  { href: '/app', label: 'Início', icon: ic(<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10" />) },
  { href: '/app/entrevista', label: 'Entrevista', icon: ic(<path d="M4 5h16v11H9l-5 4V5Z" />) },
  { href: '/app/estrategia', label: 'Estratégia', icon: ic(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />) },
  { href: '/app/redes', label: 'Redes', icon: ic(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>) },
  { href: '/app/conteudos', label: 'Conteúdos', soon: true, icon: ic(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>) },
];

const ACCOUNT: Item[] = [
  { href: '/app/perfil', label: 'Perfil', icon: ic(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>) },
  {
    href: '/app/configuracoes',
    label: 'Configurações',
    icon: ic(
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </>,
    ),
  },
];

function NavLinks({ items, pathname }: { items: Item[]; pathname: string }) {
  return (
    <>
      {items.map((it) => {
        const active = it.href === '/app' ? pathname === '/app' : pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className="navItem" aria-current={active ? 'page' : undefined}>
            {it.icon}
            {it.label}
            {it.soon && <span className="soon">em breve</span>}
          </Link>
        );
      })}
    </>
  );
}

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="navGroup">
        <NavLinks items={MAIN} pathname={pathname} />
      </div>
      <div className="navGroup">
        <div className="navLabel">Conta</div>
        <NavLinks items={ACCOUNT} pathname={pathname} />
      </div>
    </nav>
  );
}
