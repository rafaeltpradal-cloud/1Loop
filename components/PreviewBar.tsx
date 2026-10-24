import Link from 'next/link';
import { PREVIEW, previewUsage } from '@/lib/access';
import { foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS, brl, type PlanId } from '@/lib/plans';

// Faixa fixa no topo do app enquanto a conta está na prévia (sem cartão).
export async function PreviewBar({ userId, plan }: { userId: string; plan: PlanId }) {
  const used = await previewUsage(userId);
  const posts = Math.min(PREVIEW.posts, used.posts);
  const founders = foundersOpen() && priceNow(plan) !== PLANS[plan].priceFull;
  return (
    <div className="previewBar" role="note">
      <div className="previewBarText">
        <b>Prévia grátis</b>
        <span>
          {used.strategies ? 'Estratégia pronta' : 'Estratégia depois da entrevista'} · {posts} de {PREVIEW.posts} posts
          {founders ? ` · Founders ${brl(priceNow(plan))}/mês ${foundersCountdown()}` : ''}
        </span>
      </div>
      <Link className="btn3d btnSm" href="/app/assinar">Começar 7 dias grátis</Link>
    </div>
  );
}
