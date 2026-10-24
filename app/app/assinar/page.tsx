import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPreviewContext } from '@/lib/session';
import { PREVIEW, previewUsage } from '@/lib/access';
import { FOUNDERS_ENDS_LABEL, foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS, brl, type PlanId } from '@/lib/plans';

export const metadata = { title: 'Começar o teste · 1loop creators' };

const ORDER: PlanId[] = ['basic', 'pro', 'multi'];

// Fim da prévia: mostra o que a pessoa já tem e o que libera ao começar os 7 dias (aqui entra o cartão).
export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const ctx = await getPreviewContext();
  if (!ctx.preview) redirect('/app/plano');
  const { plano } = await searchParams;
  const chosen: PlanId = plano && plano in PLANS ? (plano as PlanId) : ctx.plan;
  const used = await previewUsage(ctx.userId);
  const founders = foundersOpen();

  const unlocks = [
    `${PLANS[chosen].postsPerMonth} posts por mês, no ritmo do plano (${PLANS[chosen].rhythm.toLowerCase()})`,
    'Publicação automática no LinkedIn e no Instagram, no horário certo',
    'Refazer e ajustar qualquer post com a IA',
    'Novas versões da estratégia todo mês',
    'Suas fotos e referências de estilo nos posts',
  ];

  return (
    <div className="page">
      <div className="pageHead rise">
        <div className="eyebrow">Sua prévia</div>
        <h1 className="pageTitle">
          <span className="graphite">Gostou, {ctx.firstName}?</span> <span className="grad">Libere o mês inteiro.</span>
        </h1>
        <p className="pageSub">7 dias grátis. Nada é cobrado antes do fim do teste e você cancela em 1 clique.</p>
      </div>

      <div className="assinarGrid">
        <section className="card assinarCard" aria-labelledby="h-ja">
          <h2 id="h-ja" className="assinarH">O que você já tem</h2>
          <ul className="assinarList">
            <li className={used.strategies ? 'ok' : ''}>{used.strategies ? '✓' : '○'} Estratégia de 30 dias {used.strategies ? '' : '(falta a entrevista)'}</li>
            <li className={used.posts ? 'ok' : ''}>{used.posts ? '✓' : '○'} {Math.min(used.posts, PREVIEW.posts)} de {PREVIEW.posts} posts da prévia</li>
          </ul>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {used.strategies ? <Link className="btnGhost btnSm" href="/app/estrategia">Ver estratégia</Link> : <Link className="btnGhost btnSm" href="/app/entrevista">Fazer a entrevista</Link>}
            {used.strategies > 0 && <Link className="btnGhost btnSm" href="/app/conteudos">Ver posts</Link>}
          </div>
          <h2 className="assinarH" style={{ marginTop: 8 }}>O que libera no teste</h2>
          <ul className="assinarList">
            {unlocks.map((u) => (
              <li key={u} className="ok">✓ {u}</li>
            ))}
          </ul>
        </section>

        <section className="card assinarCard" aria-labelledby="h-plano">
          <h2 id="h-plano" className="assinarH">Escolha o plano</h2>
          {founders && (
            <div className="foundersBar" role="note"><span className="dot" aria-hidden="true" />Preço Founders até {FOUNDERS_ENDS_LABEL}, {foundersCountdown()}. Fica travado enquanto você for assinante.</div>
          )}
          <div className="assinarPlans" role="radiogroup" aria-label="Plano">
            {ORDER.map((id) => {
              const p = PLANS[id];
              const now = priceNow(id);
              return (
                <Link key={id} href={`/app/assinar?plano=${id}`} role="radio" aria-checked={id === chosen} className={`assinarPlan ${id === chosen ? 'on' : ''}`} scroll={false}>
                  <span className="assinarPlanTop">
                    <b>{p.name}</b>
                    <span>
                      {now !== p.priceFull && <s className="muted">{brl(p.priceFull)}</s>} <b>{brl(now)}</b><span className="muted">/mês</span>
                    </span>
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>{p.rhythm}</span>
                </Link>
              );
            })}
          </div>
          <a className="btn3d" href={`/pagamento?plano=${chosen}`} style={{ justifyContent: 'center' }}>Começar 7 dias grátis no {PLANS[chosen].name}</a>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            O cartão é pedido no Stripe, ambiente seguro. Primeira cobrança de {brl(priceNow(chosen))} só no fim dos 7 dias, e só se você não cancelar.
          </p>
        </section>
      </div>
    </div>
  );
}
