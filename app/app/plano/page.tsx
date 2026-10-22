import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { recordExtraPack } from '@/lib/billing';
import { EXTRA_PACK, PLANS, brl } from '@/lib/plans';
import { PlanCards } from './PlanCards';

export const metadata = { title: 'Plano · 1loop creators' };

const STATUS: Record<string, string> = {
  trialing: 'Em teste',
  active: 'Ativa',
  past_due: 'Pagamento pendente',
};

export default async function PlanoPage({ searchParams }: { searchParams: Promise<{ pacote?: string }> }) {
  const ctx = await getAppContext();
  const { pacote } = await searchParams;

  // Volta do pagamento do pacote: confirma com o Stripe e registra (caso o webhook ainda não tenha chegado).
  let bought = false;
  if (pacote && pacote.startsWith('cs_')) {
    try {
      const session = await stripe().checkout.sessions.retrieve(pacote);
      if (session.client_reference_id === ctx.userId) bought = await recordExtraPack(session);
    } catch (err) {
      console.error('[pacote]', err);
    }
  }

  const supabase = await createClient();
  const { data: packs } = await supabase.from('extra_packs').select('posts').eq('user_id', ctx.userId);
  const extras = (packs ?? []).reduce((sum: number, p: { posts: number | null }) => sum + (p.posts ?? 0), 0);
  const plan = PLANS[ctx.plan];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1080 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Plano</div>
        <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 38px)', letterSpacing: '-1px' }}>
          <span className="graphite">Seu plano é o</span> <span className="grad">{plan.name}.</span>
        </h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="pill">
            <span className="dot" style={{ background: ctx.status === 'past_due' ? 'var(--amber)' : ctx.status === 'trialing' ? 'var(--violet)' : 'var(--teal)' }} />
            {STATUS[ctx.status] ?? ctx.status}
            {ctx.trialDaysLeft !== null && ` · ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}`}
          </span>
          <span className="pill">{plan.rhythm}</span>
          {extras > 0 && <span className="pill">+{extras} posts extras</span>}
        </div>
      </div>

      {bought && <div className="formOk" role="status">Pacote comprado! {EXTRA_PACK.posts} posts extras foram somados à sua conta.</div>}

      <section aria-labelledby="h-planos" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h2 id="h-planos" style={{ fontSize: 18 }}>Mudar de plano</h2>
        <PlanCards current={ctx.plan} trialing={ctx.status === 'trialing'} />
      </section>

      <section aria-labelledby="h-pacote" className="card" style={{ padding: 26, display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '999 1 380px', minWidth: 0 }}>
          <div className="eyebrow">Pacote extra</div>
          <h2 id="h-pacote" style={{ fontSize: 22 }}>+{EXTRA_PACK.posts} posts avulsos por {brl(EXTRA_PACK.price)}</h2>
          <p className="muted" style={{ fontSize: 14, lineHeight: 1.55 }}>
            Para uma campanha, um lançamento ou uma semana mais intensa. Pagamento único, sem mudar seu plano.
            {extras > 0 ? ` Você tem ${extras} posts extras disponíveis.` : ''}
          </p>
        </div>
        <form action="/api/pacote" method="post">
          <button className="btnGhost" type="submit">Comprar pacote</button>
        </form>
      </section>

      <div className="card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', boxShadow: 'none' }}>
        <span className="muted" style={{ fontSize: 14 }}>Cartão, faturas e cancelamento ficam no portal seguro do Stripe.</span>
        <form action="/api/stripe/portal" method="post">
          <button className="linkBtn" type="submit" style={{ fontSize: 13 }}>Gerenciar pagamento</button>
        </form>
      </div>
    </div>
  );
}
