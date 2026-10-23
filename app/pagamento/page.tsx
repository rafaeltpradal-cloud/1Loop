import { isPlanId, PLANS } from '@/lib/plans';
import { GoToCheckout } from './GoToCheckout';

export const metadata = { title: 'Pagamento · 1loop creators' };

// Passo curto entre o cadastro e o Stripe: registra a conversão nos anúncios e segue para o pagamento.
export default async function PagamentoPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = isPlanId(plano) ? plano : 'pro';
  const p = PLANS[plan];
  return <GoToCheckout plan={plan} value={p.priceFounders ?? p.priceFull} />;
}
