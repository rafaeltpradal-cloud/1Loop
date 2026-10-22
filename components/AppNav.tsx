'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: Array<{ href: string; label: string; soon?: boolean }> = [
  { href: '/app', label: 'Início' },
  { href: '/app/entrevista', label: 'Entrevista' },
  { href: '/app/estrategia', label: 'Estratégia' },
  { href: '/app/conteudos', label: 'Conteúdos', soon: true },
  { href: '/app/conta', label: 'Conta e plano' },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {ITEMS.map((it) => {
        const active = it.href === '/app' ? pathname === '/app' : pathname.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className="navItem" aria-current={active ? 'page' : undefined}>
            {it.label}
            {it.soon && <span className="soon">em breve</span>}
          </Link>
        );
      })}
    </nav>
  );
}
