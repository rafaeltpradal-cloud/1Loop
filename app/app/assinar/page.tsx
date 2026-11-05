import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPreviewContext } from '@/lib/session';
import { freeTrialEnd, previewUsage } from '@/lib/access';
import { FOUNDERS_ENDS_LABEL, foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS, brl, type PlanId } from '@/lib/plans';
import { createClient } from '@/lib/supabase/server';
import { activeOffer, money, offerCoupon, offerPrice } from '@/lib/offers';

export const metadata = { title: 'Assinar · 1loop creators' };

const ORDER: PlanId[] = ['basic', 'pro', 'multi'];

// Assinar: durante o teste grátis (sem cartão) ou depois que ele acaba. Durante o teste, a cobrança só começa no fim dele.
export default async function AssinarPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const ctx = await getPreviewContext();
  if (!ctx.preview && !ctx.freeTrial) redirect('/app/plano');
  const { plano } = await searchParams;
  const chosen: PlanId = plano && plano in PLANS ? (plano as PlanId) : ctx.plan;
  const used = await previewUsage(ctx.userId);
  const founders = foundersOpen();
  // Condição especial individual (10% abaixo do Founders no 1º mês), se a conta tiver.
  const { data: { user } } = await (await createClient()).auth.getUser();
  const offer = activeOffer(user) && offerCoupon(chosen) ? offerPrice(chosen) : null;
  // Assinando com mais de 2 dias de teste pela frente, a 1ª cobrança fica para o fim do teste (ver /checkout).
  const end = user ? freeTrialEnd(user) : new Date();
  const later = end.getTime() - Date.now() > 49 * 3600000;
  const endLabel = end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

  const unlocks = [
    `${PLANS[chosen].postsPerMonth} posts por mês, no ritmo do plano (${PLANS[chosen].rhythm.toLowerCase()})`,
    'Publicação automática no LinkedIn e no Instagram, no horário certo',
    'Refazer e ajustar qualquer post com a IA, criar do zero e comentar com a IA',
    'Novas versões da estratégia todo mês',
    'Suas fotos e referências de estilo nos posts',
  ];

  return (
    <div className="page">
      <div className="pageHead rise">
        <div className="eyebrow">{ctx.freeTrial ? `Teste grátis · ${ctx.trialDaysLeft ?? 0} ${ctx.trialDaysLeft === 1 ? 'dia' : 'dias'}` : 'Seu teste acabou'}</div>
        <h1 className="pageTitle">
          <span className="graphite">{ctx.freeTrial ? `Continue no ritmo, ${ctx.firstName}.` : `Seus posts estão aqui, ${ctx.firstName}.`}</span> <span className="grad">{ctx.freeTrial ? 'Garanta o seu plano.' : 'Volte a publicar.'}</span>
        </h1>
        <p className="pageSub">{later ? `Assine agora e nada muda até ${endLabel}: a primeira cobrança só acontece no fim do teste. Cancele em 1 clique.` : 'Assine para voltar a gerar, ajustar com a IA e publicar sozinho no horário certo. Cancele em 1 clique.'}</p>
      </div>

      <div className="assinarGrid">
        <section className="card assinarCard" aria-labelledby="h-ja">
          <h2 id="h-ja" className="assinarH">O que você já tem</h2>
          <ul className="assinarList">
            <li className={used.strategies ? 'ok' : ''}>{used.strategies ? '✓' : '○'} Estratégia de 30 dias {used.strategies ? '' : '(falta a entrevista)'}</li>
            <li className={used.posts ? 'ok' : ''}>{used.posts ? '✓' : '○'} {used.posts} {used.posts === 1 ? 'post criado' : 'posts criados'}</li>
          </ul>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {used.strategies ? <Link className="btnGhost btnSm" href="/app/estrategia">Ver estratégia</Link> : <Link className="btnGhost btnSm" href="/app/entrevista">Fazer a entrevista</Link>}
            {used.strategies > 0 && <Link className="btnGhost btnSm" href="/app/conteudos">Ver posts</Link>}
          </div>
          <h2 className="assinarH" style={{ marginTop: 8 }}>O que vem com o plano</h2>
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
          {offer !== null && (
            <div className="foundersBar" role="note"><span className="dot" aria-hidden="true" />Condição especial para você: <b>&nbsp;{money(offer)} no 1º mês</b>&nbsp;(10% abaixo do Founders). No pagamento aparece o preço Founders; o desconto extra entra sozinho na primeira cobrança.</div>
          )}
          <a className="btn3d" href={`/pagamento?plano=${chosen}`} style={{ justifyContent: 'center' }}>Assinar o {PLANS[chosen].name}</a>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>
            Pagamento no Stripe, ambiente seguro. Primeira cobrança de {offer !== null ? money(offer) : brl(priceNow(chosen))} {later ? `só em ${endLabel}, no fim do seu teste` : 'hoje'}. Cancele quando quiser.
          </p>
        </section>
      </div>
    </div>
  );
}
