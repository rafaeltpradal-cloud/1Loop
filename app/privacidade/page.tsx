import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Política de privacidade · 1loop creators' };

export default function PrivacidadePage() {
  return (
    <PublicShell>
      <article className="card" style={{ padding: 32, maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h1 style={{ fontSize: 30 }}>Política de privacidade</h1>
        <p className="muted">[Texto da política de privacidade, em conformidade com a LGPD, a ser redigido com apoio jurídico antes do lançamento.]</p>
      </article>
    </PublicShell>
  );
}
