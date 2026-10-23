import Link from 'next/link';
import { getAppContext } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { isNetworkId, networkByName, type NetworkId } from '@/lib/networks';
import { NetworksBoard } from './NetworksBoard';
import { NetworkConnect, type ConnectState } from '@/components/NetworkConnect';
import { createAdminClient } from '@/lib/supabase/admin';
import { linkedinConfigured } from '@/lib/linkedin';
import { instagramConfigured } from '@/lib/instagram';

export const metadata = { title: 'Redes · 1loop creators' };

export default async function RedesPage({ searchParams }: { searchParams: Promise<{ linkedin?: string; instagram?: string }> }) {
  const { linkedin: liFlash, instagram: igFlash } = await searchParams;
  const ctx = await getAppContext();
  const supabase = await createClient();
  const [{ data: accounts }, { data: interview }] = await Promise.all([
    supabase.from('social_accounts').select('network, handle, status').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
    supabase.from('interviews').select('answers').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).maybeSingle(),
  ]);

  const answers = (interview?.answers ?? {}) as Record<string, unknown>;
  const chosen = (Array.isArray(answers.redes) ? answers.redes : [])
    .map((r) => (typeof r === 'string' ? networkByName(r)?.id : undefined))
    .filter((x): x is NetworkId => !!x);

  const saved: Partial<Record<NetworkId, { handle: string; status: string }>> = {};
  for (const a of accounts ?? []) {
    if (isNetworkId(a.network)) saved[a.network] = { handle: a.handle as string, status: a.status as string };
  }
  const count = Object.keys(saved).length;

  // Conexões oficiais (o token não sai do servidor).
  const { data: conns } = await createAdminClient()
    .from('social_connections')
    .select('network, name, picture, expires_at, meta')
    .eq('user_id', ctx.userId).eq('brand_id', ctx.brandId);
  const stateOf = (network: 'linkedin' | 'instagram', configured: boolean): ConnectState => {
    if (!configured) return { kind: 'indisponivel' };
    const c = (conns ?? []).find((x) => x.network === network);
    if (!c) return { kind: 'desconectado' };
    const daysLeft = Math.max(0, Math.ceil((new Date(c.expires_at as string).getTime() - Date.now()) / 86400000));
    const type = (c.meta as { account_type?: string } | null)?.account_type;
    const detail = network === 'instagram' && type ? (type === 'BUSINESS' ? 'conta Comercial' : 'conta de Criador') : undefined;
    return { kind: 'conectado', name: network === 'instagram' ? `@${c.name ?? ''}` : ((c.name as string) ?? ''), picture: (c.picture as string | null) ?? null, expiresAt: c.expires_at as string, daysLeft, detail };
  };
  const li = stateOf('linkedin', linkedinConfigured());
  const ig = stateOf('instagram', instagramConfigured());

  return (
    <div className="page">
      <div className="pageHead">
        <div className="eyebrow">Redes</div>
        <h1 className="pageTitle">
          <span className="graphite">Suas</span> <span className="grad">redes.</span>
        </h1>
        <p className="pageSub">Conecte LinkedIn e Instagram para publicar no horário, sem abrir o app.</p>
      </div>

      <div className="grid2">
        <NetworkConnect network="linkedin" state={li} flash={liFlash} />
        <NetworkConnect network="instagram" state={ig} flash={igFlash} />
      </div>

      <NetworksBoard chosen={chosen} saved={saved} />

      <div className="nextRow">
        <span>Próximo passo: <b>conteúdos da semana</b></span>
        <span style={{ display: 'flex', gap: 8 }}>
          <Link className="btnGhost btnSm" href="/app/estrategia">Voltar</Link>
          <Link className="btn3d btnSm" href="/app/conteudos">{count ? 'Avançar →' : 'Pular por agora'}</Link>
        </span>
      </div>
    </div>
  );
}
