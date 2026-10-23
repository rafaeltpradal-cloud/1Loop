import { PublicShell } from '@/components/PublicShell';
import { LegalText } from '@/components/LegalText';
import { LEGAL_UPDATED, TERMOS } from '@/lib/legal';

export const metadata = { title: 'Termos de uso · 1loop creators' };

export default function TermosPage() {
  return (
    <PublicShell>
      <LegalText title="Termos de uso" updated={LEGAL_UPDATED} text={TERMOS} />
    </PublicShell>
  );
}
