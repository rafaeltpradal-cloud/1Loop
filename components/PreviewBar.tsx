import Link from 'next/link';
import { previewUsage } from '@/lib/access';
import { foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS, brl, type PlanId } from '@/lib/plans';

// Faixa no topo do app quando o teste grátis acabou e a pessoa ainda não assinou.
export async function PreviewBar({ userId, plan }: { userId: string; plan: PlanId }) {
  const used = await previewUsage(userId);
  const posts = used.posts;
  const founders = foundersOpen() && priceNow(plan) !== PLANS[plan].priceFull;
  return (
    <div className="previewBar" role="note">
      <div className="previewBarText">
        <b>Seu teste grátis acabou</b>
        <span>
          {posts > 0 ? `${used.strategies ? 'Sua estratégia e ' : ''}${posts === 1 ? 'seu post continuam' : `seus ${posts} posts continuam`} aqui.` : 'Tudo o que você fez continua aqui.'} Assine para voltar a gerar e publicar
          {founders ? ` · Founders ${brl(priceNow(plan))}/mês ${foundersCountdown()}` : ''}
        </span>
      </div>
      <Link className="btn3d btnSm" href="/app/assinar">Assinar e continuar</Link>
    </div>
  );
}
