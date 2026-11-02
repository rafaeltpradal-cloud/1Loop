import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
import { ProfileScore } from './ProfileScore';

// Ferramenta grátis (isca para anúncios e busca): 9 perguntas, nota de 0 a 100 e o que mudar primeiro.
// Não pede e-mail: o cadastro sem cartão no fim é o próximo passo natural.
export const metadata: Metadata = {
  title: 'Nota do seu LinkedIn em 1 minuto · 1loop creators',
  description: 'Responda 9 perguntas e descubra a nota do seu perfil no LinkedIn para vender: o que já está bom e as 3 mudanças que mais pesam. Grátis, sem cadastro.',
  alternates: { canonical: '/nota-linkedin' },
  openGraph: { title: 'Qual a nota do seu LinkedIn para vender?', description: '9 perguntas, 1 minuto, nota de 0 a 100 e o que mudar primeiro.' },
};

export default function NotaLinkedInPage() {
  return (
    <PublicShell right={<Link className="btnGhost btnSm" href="/entrar">Entrar</Link>}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">Grátis · 1 minuto · sem cadastro</span>
          <h1 className="pageTitle" style={{ fontSize: 'clamp(30px, 5vw, 44px)' }}>
            <span className="graphite">Qual a nota do seu LinkedIn</span> <span className="grad">para vender?</span>
          </h1>
          <p className="pageSub" style={{ fontSize: 17 }}>O cliente olha seu perfil antes de responder. Responda 9 perguntas e veja sua nota de 0 a 100 e as 3 mudanças que mais pesam.</p>
        </div>
        <ProfileScore />
      </div>
    </PublicShell>
  );
}
