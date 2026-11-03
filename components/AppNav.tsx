'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = { href: string; label: string; icon: React.ReactNode; soon?: boolean };

const ic = (d: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

const I = {
  home: ic(<path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10" />),
  posts: ic(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  story: ic(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  comment: ic(<path d="M4 5h16v11H9l-5 4V5ZM8 9.5h8M8 12.5h5" />),
  strategy: ic(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  perf: ic(<path d="M3 17l5-5 4 4 8-8M15 8h5v5" />),
  nets: ic(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
  plus: ic(<path d="M12 5v14M5 12h14" />),
};

// Menu em grupos: criar (o dia a dia), planejar, resultados e conectar.
const GROUPS: { label: string; items: (Item & { match?: string[]; badge?: 'drafts' })[] }[] = [
  {
    label: 'Criar',
    items: [
      { href: '/app', label: 'Início', icon: I.home },
      { href: '/app/conteudos', label: 'Conteúdos', icon: I.posts, badge: 'drafts' },
      { href: '/app/conteudos/criar', label: 'Crie seu post', icon: I.plus },
      { href: '/app/conteudos/novo', label: 'Contar uma história', icon: I.story },
      { href: '/app/comentarios', label: 'Comentar em posts', icon: I.comment },
    ],
  },
  { label: 'Planejar', items: [{ href: '/app/estrategia', label: 'Estratégia', icon: I.strategy, match: ['/app/entrevista'] }] },
  { label: 'Resultados', items: [{ href: '/app/desempenho', label: 'Desempenho', icon: I.perf }] },
  { label: 'Conectar', items: [{ href: '/app/redes', label: 'Redes', icon: I.nets }] },
];

// Barra de baixo no celular: 5 atalhos, com o "novo post" no meio.
const TABS: Item[] = [
  { href: '/app', label: 'Início', icon: I.home },
  { href: '/app/conteudos', label: 'Conteúdos', icon: I.posts },
  { href: '/app/conteudos/criar', label: 'Novo', icon: I.plus },
  { href: '/app/desempenho', label: 'Resultados', icon: I.perf },
  { href: '/app/redes', label: 'Redes', icon: I.nets },
];

const ACCOUNT: Item[] = [
  { href: '/app/indicar', label: 'Indique e ganhe', icon: ic(<><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M12 8v13M19 13v8H5v-8M12 8S10.5 3 8 3a2.5 2.5 0 0 0 0 5M12 8s1.5-5 4-5a2.5 2.5 0 0 1 0 5" /></>) },
  { href: '/app/marcas', label: 'Marcas', icon: ic(<><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>) },
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

/** O item mais específico que casa com a página atual ganha o destaque (Conteúdos não acende em "Contar uma história"). */
function activeHref(pathname: string, hrefs: { href: string; match?: string[] }[]) {
  let best = '';
  for (const it of hrefs) {
    const paths = [it.href, ...(it.match ?? [])];
    for (const h of paths) {
      const hit = h === '/app' ? pathname === '/app' : pathname === h || pathname.startsWith(`${h}/`);
      if (hit && h.length > best.length) best = it.href;
    }
  }
  return best;
}

function NavLinks({ items, pathname, counts }: { items: (Item & { match?: string[]; badge?: 'drafts' })[]; pathname: string; counts?: NavCounts }) {
  const all = GROUPS.flatMap((g) => g.items).concat(ACCOUNT);
  const current = activeHref(pathname, all);
  return (
    <>
      {items.map((it) => {
        const n = it.badge === 'drafts' ? counts?.drafts ?? 0 : 0;
        return (
          <Link key={it.href} href={it.href} className="navItem" aria-current={current === it.href ? 'page' : undefined}>
            {it.icon}
            {it.label}
            {n > 0 && <span className="navBadge" aria-label={`${n} para revisar`}>{n}</span>}
            {it.soon && <span className="soon">em breve</span>}
          </Link>
        );
      })}
    </>
  );
}

export type NavCounts = { drafts: number };

export function AppNav({ group, counts }: { group: 'main' | 'account' | 'tabs'; counts?: NavCounts }) {
  const pathname = usePathname();
  if (group === 'tabs') {
    const current = activeHref(pathname, TABS);
    return (
      <nav aria-label="Menu" className="tabBar">
        {TABS.map((it) => (
          <Link key={it.href} href={it.href} className={it.href === '/app/conteudos/criar' ? 'tabItem tabNew' : 'tabItem'} aria-current={current === it.href ? 'page' : undefined}>
            {it.icon}
            <span>{it.label}</span>
          </Link>
        ))}
      </nav>
    );
  }
  if (group === 'account') {
    return (
      <nav aria-label="Conta" className="navGroup">
        <div className="navLabel">Conta</div>
        <NavLinks items={ACCOUNT} pathname={pathname} />
      </nav>
    );
  }
  return (
    <nav aria-label="Menu" className="navGroups">
      <Link href="/app/conteudos/criar" className="navNew">
        {I.plus}
        Novo post
      </Link>
      {GROUPS.map((g) => (
        <div key={g.label} className="navGroup">
          <div className="navLabel">{g.label}</div>
          <NavLinks items={g.items} pathname={pathname} counts={counts} />
        </div>
      ))}
    </nav>
  );
}
