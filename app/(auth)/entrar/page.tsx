import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
import { SignInForm } from './SignInForm';

export const metadata = { title: 'Entrar · 1loop creators' };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <PublicShell right={<span className="muted" style={{ fontSize: 14 }}>Novo por aqui? <Link href="/planos">Ver planos</Link></span>}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 className="rise" style={{ fontSize: 'clamp(28px, 3.4vw, 38px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
          <span className="graphite">Bem-vindo de volta.</span>
        </h1>
        <SignInForm next={next || '/app'} />
      </div>
    </PublicShell>
  );
}
