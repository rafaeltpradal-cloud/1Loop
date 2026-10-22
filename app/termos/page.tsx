import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Termos de uso · 1loop creators' };

export default function TermosPage() {
  return (
    <PublicShell>
      <article className="card" style={{ padding: 32, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 30 }}>Termos de uso</h1>
        <p className="muted">[Texto dos termos de uso a ser redigido com apoio jurídico antes do lançamento.]</p>
      </article>
    </PublicShell>
  );
}
