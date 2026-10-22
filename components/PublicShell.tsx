import { Brand } from '@/components/Logo';

export function PublicShell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ borderBottom: '1px solid var(--line)', background: 'var(--header-bg)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <Brand />
          {right}
        </div>
      </header>
      <main style={{ flex: 1, width: '100%', maxWidth: 1180, margin: '0 auto', padding: '48px 24px 80px' }}>{children}</main>
    </div>
  );
}

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ['Plano', 'Cadastro', 'Pagamento'];
  return (
    <ol aria-label="Etapas" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {labels.map((l, i) => {
        const n = i + 1;
        const on = n === current;
        const done = n < current;
        return (
          <li key={l} aria-current={on ? 'step' : undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: on ? 'var(--ink)' : 'var(--muted)' }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, background: on ? 'var(--grey)' : done ? 'var(--step-done-bg)' : 'var(--track)', color: on ? '#fff' : done ? 'var(--step-done-ink)' : 'var(--muted)' }}>{done ? '✓' : n}</span>
            {l}
            {n < 3 && <span aria-hidden="true" style={{ color: 'var(--faint)', margin: '0 4px' }}>—</span>}
          </li>
        );
      })}
    </ol>
  );
}
