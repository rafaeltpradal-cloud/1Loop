import { getAppContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { listContext } from '@/lib/userContext';
import { activeMcpToken } from '@/lib/mcp';
import { ContextBoard } from './ContextBoard';

export const metadata = { title: 'Contexto e IAs · 1loop creators' };

export default async function ContextoPage() {
  const ctx = await getAppContext();
  const admin = createAdminClient();
  const [items, link] = await Promise.all([listContext(admin, ctx.userId, ctx.brandId, 300), activeMcpToken(admin, ctx.userId, ctx.brandId)]);
  return (
    <div className="page">
      <div className="pageHead">
        <div className="eyebrow">Planejar</div>
        <h1 className="pageTitle">
          <span className="graphite">Contexto</span> <span className="grad">e IAs.</span>
        </h1>
        <span className="pageSub">Quanto mais a 1loop sabe de você, menos genérico fica o post. Números, cases e opiniões daqui viram base real dos seus conteúdos.</span>
      </div>
      <ContextBoard items={items} link={link} />
    </div>
  );
}
