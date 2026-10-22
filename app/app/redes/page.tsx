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
    supabase.from('social_accounts').select('network, handle, status').eq('user_id', ctx.userId),
    supabase.from('interviews').select('answers').eq('user_id', ctx.userId).maybeSingle(),
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
    .eq('user_id', ctx.userId);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1180 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 760 }}>
        <div className="eyebrow">Passo 3 · Suas redes</div>
        <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
          <span className="graphite">Onde seus conteúdos</span> <span className="grad">vão sair.</span>
        </h1>
        <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
          Cadastre seus perfis. As redes da sua estratégia aparecem primeiro. No LinkedIn e no Instagram, a publicação já pode ser automática: conecte uma vez e agende. As outras redes chegam em seguida.
        </p>
      </div>

      <div className="grid2">
        <NetworkConnect network="linkedin" state={li} flash={liFlash} />
        <NetworkConnect network="instagram" state={ig} flash={igFlash} />
      </div>

      <NetworksBoard chosen={chosen} saved={saved} />

      <div className="card" style={{ padding: 24, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="eyebrow">Próximo passo</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Conteúdos da semana</div>
          <div className="muted" style={{ fontSize: 14 }}>{count ? `${count} ${count === 1 ? 'perfil cadastrado' : 'perfis cadastrados'}.` : 'Você pode cadastrar depois, se preferir.'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btnGhost btnSm" href="/app/estrategia">Voltar à estratégia</Link>
          <Link className="btn3d" href="/app/conteudos">{count ? 'Avançar' : 'Pular por agora'}</Link>
        </div>
      </div>
    </div>
  );
}
