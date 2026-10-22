'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_THEME, type ThemePref } from '@/lib/theme';

type ThemeWindow = Window & { __setTheme?: (p: ThemePref) => void; __getTheme?: () => ThemePref };

const OPTIONS: Array<{ id: ThemePref; label: string; icon: React.ReactNode }> = [
  {
    id: 'light',
    label: 'Claro',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    id: 'dark',
    label: 'Escuro',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    ),
  },
  {
    id: 'system',
    label: 'Sistema',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    ),
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const [pref, setPref] = useState<ThemePref>(DEFAULT_THEME);

  useEffect(() => {
    const w = window as ThemeWindow;
    if (w.__getTheme) setPref(w.__getTheme());
  }, []);

  function choose(p: ThemePref) {
    setPref(p);
    (window as ThemeWindow).__setTheme?.(p);
  }

  return (
    <div className={compact ? 'themeSwitch compact' : 'themeSwitch'} role="radiogroup" aria-label="Tema">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={pref === o.id} onClick={() => choose(o.id)} title={o.label} aria-label={o.label}>
          {o.icon}
          {!compact && o.label}
        </button>
      ))}
    </div>
  );
}
