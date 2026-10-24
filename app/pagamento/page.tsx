import { isPlanId } from '@/lib/plans';
import { priceNow } from '@/lib/founders';
import { GoToCheckout } from './GoToCheckout';

export const metadata = { title: 'Pagamento · 1loop creators' };

// Passo curto antes do Stripe: registra o início do checkout nos anúncios e segue para o pagamento.
export default async function PagamentoPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = isPlanId(plano) ? plano : 'pro';
  return <GoToCheckout plan={plan} value={priceNow(plan)} />;
}
