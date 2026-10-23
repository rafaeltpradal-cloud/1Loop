import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLANS } from '@/lib/plans';
import { BrandManager, type BrandInfo } from './BrandManager';

export const metadata = { title: 'Marcas · 1loop creators' };

const NET: Record<string, string> = { linkedin: 'LinkedIn', instagram: 'Instagram' };

export default async function MarcasPage() {
  const ctx = await getAppContext();
  const admin = createAdminClient();
  const ids = ctx.brands.map((b) => b.id);
  const [{ data: interviews }, { data: strategies }, { data: conns }] = await Promise.all([
    admin.from('interviews').select('brand_id, completed_at').eq('user_id', ctx.userId).in('brand_id', ids),
    admin.from('strategies').select('brand_id').eq('user_id', ctx.userId).in('brand_id', ids),
    admin.from('social_connections').select('brand_id, network, name').eq('user_id', ctx.userId).in('brand_id', ids),
  ]);

  const info: BrandInfo[] = ctx.brands.map((b) => ({
    ...b,
    interview: !!(interviews ?? []).find((i) => i.brand_id === b.id && i.completed_at),
    strategy: (strategies ?? []).some((s) => s.brand_id === b.id),
    networks: (conns ?? []).filter((c) => c.brand_id === b.id).map((c) => `${NET[c.network as string] ?? c.network}${c.name ? ` · ${c.name}` : ''}`),
  }));
  const multi = ctx.brandLimit > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 820 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="eyebrow">Conta</div>
        <h1 className="pageTitle">
          <span className="graphite">Suas</span> <span className="grad">marcas.</span>
        </h1>
        <p className="pageSub">Cada marca tem entrevista, estratégia, conteúdos e redes próprios.</p>
      </div>

      {!multi && (
        <div className="card" style={{ padding: 24, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 320px' }}>
            <b style={{ fontSize: 16 }}>Várias marcas são do plano Multi</b>
            <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
              No {PLANS[ctx.plan].name}, você tem uma estratégia e usa em todas as suas redes. No Multi, são até {PLANS.multi.brands} marcas, cada uma com a
              estratégia dela.
            </span>
          </div>
          <Link className="btn3d btnSm" href="/app/plano">Ver o Multi</Link>
        </div>
      )}

      <BrandManager brands={info} current={ctx.brandId} limit={ctx.brandLimit} />
    </div>
  );
}
