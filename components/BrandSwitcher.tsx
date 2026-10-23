'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { switchBrand } from '@/app/app/marcas/actions';

type B = { id: number; name: string; locked: boolean };

const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '•';

/** Mostra a marca em uso e troca de marca (plano Multi). */
export function BrandSwitcher({ current, brands, limit, compact }: { current: number; brands: B[]; limit: number; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const cur = brands.find((b) => b.id === current) ?? brands[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!cur || (limit <= 1 && brands.length <= 1)) return null;

  function pick(b: B) {
    if (b.locked || b.id === current) return setOpen(false);
    setError('');
    start(async () => {
      const r = await switchBrand(b.id);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.push('/app');
      router.refresh();
    });
  }

  return (
    <div className={compact ? 'brandSw compact' : 'brandSw'} ref={box}>
      <button type="button" className="brandSwBtn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={pending}>
        <span className="brandSwMark" aria-hidden="true">{initials(cur.name)}</span>
        <span className="brandSwText">
          {!compact && <span className="brandSwLabel">Marca</span>}
          <span className="brandSwName">{pending ? 'Trocando…' : cur.name}</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="m7 10 5-5 5 5M7 14l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="brandSwMenu" role="menu">
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitemradio"
              aria-checked={b.id === current}
              className="brandSwItem"
              onClick={() => pick(b)}
              disabled={b.locked}
              title={b.locked ? 'Disponível no plano Multi' : undefined}
            >
              <span className="brandSwMark sm" aria-hidden="true">{initials(b.name)}</span>
              <span className="brandSwName">{b.name}</span>
              {b.id === current && <span aria-hidden="true" className="brandSwCheck">✓</span>}
              {b.locked && <span className="brandSwLock">Multi</span>}
            </button>
          ))}
          <div className="brandSwSep" />
          <Link href="/app/marcas" className="brandSwItem" role="menuitem" onClick={() => setOpen(false)}>
            <span className="brandSwMark sm plus" aria-hidden="true">+</span>
            <span className="brandSwName">{brands.length < limit ? 'Nova marca' : 'Gerenciar marcas'}</span>
          </Link>
          {error && <div className="formError" role="alert" style={{ margin: 6 }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
