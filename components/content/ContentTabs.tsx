import Link from 'next/link';

export function ContentTabs({ active }: { active: 'semana' | 'fotos' }) {
  return (
    <nav className="contentTabs" aria-label="Conteúdos">
      <Link href="/app/conteudos" aria-current={active === 'semana' ? 'page' : undefined}>Semana</Link>
      <Link href="/app/conteudos/fotos" aria-current={active === 'fotos' ? 'page' : undefined}>Fotos e referências</Link>
    </nav>
  );
}
