import { isPlanId } from '@/lib/plans';
import { priceNow } from '@/lib/founders';
import { GoToCheckout } from './GoToCheckout';
import { createClient } from '@/lib/supabase/server';
import { EUR_PRICES, marketOf } from '@/lib/market';

export const metadata = { title: 'Pagamento · 1loop creators' };

// Passo curto antes do Stripe: registra o início do checkout nos anúncios e segue para o pagamento.
export default async function PagamentoPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = isPlanId(plano) ? plano : 'pro';
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (marketOf(user) === 'pt') return <GoToCheckout plan={plan} value={EUR_PRICES[plan]} currency="EUR" />;
  return <GoToCheckout plan={plan} value={priceNow(plan)} />;
}
