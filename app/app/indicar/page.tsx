import { getPreviewContext as getAppContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { refCode, refLink } from '@/lib/referral';
import { ShareLink } from './ShareLink';

export const metadata = { title: 'Indique e ganhe · 1loop creators' };

export default async function IndicarPage() {
  const ctx = await getAppContext();
  const admin = createAdminClient();
  const code = refCode(ctx.userId);
  const [{ count: signups }, { data: me }] = await Promise.all([
    admin.from('profiles').select('id', { count: 'exact', head: true }).filter('origem->>ref', 'eq', code),
    admin.auth.admin.getUserById(ctx.userId),
  ]);
  const meta = (me?.user?.app_metadata?.referral as { rewarded?: number; pending?: number } | undefined) ?? {};
  const link = refLink(ctx.userId);

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="pageHead">
        <div className="eyebrow">Indique e ganhe</div>
        <h1 className="pageTitle">
          <span className="graphite">Indique um amigo,</span> <span className="grad">ganhe 1 mês grátis.</span>
        </h1>
        <p className="pageSub">Mande seu link para quem vende e precisa aparecer no LinkedIn. Quando a pessoa assinar e pagar a primeira mensalidade, seu próximo mês sai de graça. Sem limite de indicações.</p>
      </div>
      <ShareLink link={link} firstName={ctx.firstName} />
      <div className="homeStats refStats">
        <div className="card"><span className="muted">Cadastros pelo seu link</span><b>{signups ?? 0}</b><span className="muted">contas criadas</span></div>
        <div className="card"><span className="muted">Meses grátis ganhos</span><b>{meta.rewarded ?? 0}</b><span className="muted">indicados que assinaram</span></div>
        <div className="card"><span className="muted">Guardados</span><b>{meta.pending ?? 0}</b><span className="muted">entram quando você assinar</span></div>
      </div>
      <ol className="card refSteps">
        <li><b>Compartilhe o link</b><span className="muted">No WhatsApp, no LinkedIn ou por e-mail.</span></li>
        <li><b>A pessoa testa grátis</b><span className="muted">Cria a conta, vê a estratégia e os primeiros posts sem cartão.</span></li>
        <li><b>Assinou, você ganha</b><span className="muted">Na primeira mensalidade paga, 1 mês do seu plano vira crédito na sua próxima fatura.</span></li>
      </ol>
    </div>
  );
}
