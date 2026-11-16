import Link from 'next/link';
import { previewUsage } from '@/lib/access';
import { foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS, brl, type PlanId } from '@/lib/plans';
import type { Market } from '@/lib/market';

// Faixa no topo do app quando o teste grátis acabou e a pessoa ainda não assinou.
export async function PreviewBar({ userId, plan, market = 'br', cardPending = false }: { userId: string; plan: PlanId; market?: Market; cardPending?: boolean }) {
  const used = await previewUsage(userId);
  const posts = used.posts;
  // Portugal: o teste foi o post publicado.
  if (market === 'pt')
    return (
      <div className="previewBar" role="note">
        <div className="previewBarText">
          <b>O seu post de teste já está no ar</b>
          <span>Assine para continuar a gerar posts na sua voz e a publicar automaticamente no LinkedIn.</span>
        </div>
        <Link className="btn3d btnSm" href="/app/assinar">Assinar e continuar</Link>
      </div>
    );
  // Grupo do cartão (teste A/B): a pessoa ainda não ativou os 7 dias grátis.
  if (cardPending)
    return (
      <div className="previewBar" role="note">
        <div className="previewBarText">
          <b>Ative seus 7 dias grátis</b>
          <span>Publicação automática, IA e o mês inteiro de posts. Nada é cobrado hoje: a primeira cobrança é só no 8º dia. Cancele em 1 clique.</span>
        </div>
        <Link className="btn3d btnSm" href="/app/assinar">Ativar 7 dias grátis</Link>
      </div>
    );
  const founders = foundersOpen() && priceNow(plan) !== PLANS[plan].priceFull;
  return (
    <div className="previewBar" role="note">
      <div className="previewBarText">
        <b>{posts > 0 ? 'Sua prévia está pronta' : 'Você está na prévia grátis'}</b>
        <span>
          {posts > 0 ? `${used.strategies ? 'Sua estratégia e ' : ''}${posts === 1 ? 'seu post estão' : `seus ${posts} posts estão`} aqui.` : 'Veja sua estratégia e os primeiros posts.'} Assine para liberar o mês inteiro e publicar sozinho · {PLANS[plan].name} {brl(priceNow(plan))}/mês · garantia de 7 dias
          {founders ? ` · ${foundersCountdown()}` : ''}
        </span>
      </div>
      <Link className="btn3d btnSm" href="/app/assinar">Assinar e publicar</Link>
    </div>
  );
}
