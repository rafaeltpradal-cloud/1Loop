import { PublicShell } from '@/components/PublicShell';
import { LegalText } from '@/components/LegalText';
import { LEGAL_UPDATED, PRIVACIDADE } from '@/lib/legal';

export const metadata = { title: 'Política de privacidade · 1loop creators' };

export default function PrivacidadePage() {
  return (
    <PublicShell>
      <LegalText title="Política de privacidade" updated={LEGAL_UPDATED} text={PRIVACIDADE} />
    </PublicShell>
  );
}
