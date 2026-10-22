'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NetworkIcon } from '@/components/NetworkIcon';
import { disconnectNetwork } from '@/app/app/redes/actions';

export type ConnectState =
  | { kind: 'indisponivel' }
  | { kind: 'desconectado' }
  | { kind: 'conectado'; name: string; picture: string | null; expiresAt: string; daysLeft: number; detail?: string };

type Net = 'linkedin' | 'instagram';
const INFO: Record<Net, { nome: string; pitch: string; renew: string }> = {
  linkedin: {
    nome: 'LinkedIn',
    pitch: 'Conecte uma vez e agende os posts do LinkedIn para saírem sozinhos no horário.',
    renew: 'O LinkedIn pede para renovar a autorização a cada 60 dias. É só clicar em Reconectar.',
  },
  instagram: {
    nome: 'Instagram',
    pitch: 'Conecte a sua conta profissional (Comercial ou Criador) e agende imagens, carrosséis, reels e stories.',
    renew: 'A gente renova a conexão com o Instagram automaticamente.',
  },
};

const FLASH: Record<string, (n: string) => { ok: boolean; text: string }> = {
  conectado: (n) => ({ ok: true, text: `${n} conectado. Agora você pode agendar os posts do ${n} em Conteúdos.` }),
  cancelado: (n) => ({ ok: false, text: `Você cancelou a autorização no ${n}. Pode tentar de novo quando quiser.` }),
  erro: (n) => ({ ok: false, text: `Não deu para conectar o ${n}. Tente de novo.` }),
  indisponivel: (n) => ({ ok: false, text: `A conexão com o ${n} ainda está sendo configurada.` }),
  pessoal: () => ({ ok: false, text: 'Essa conta do Instagram é pessoal. Mude para conta profissional (Comercial ou Criador) no app do Instagram e conecte de novo.' }),
};

export function NetworkConnect({ network, state, flash }: { network: Net; state: ConnectState; flash?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const info = INFO[network];
  const f = flash && FLASH[flash] ? FLASH[flash](info.nome) : undefined;
  const connectHref = `/api/${network}/conectar`;

  return (
    <section className="card liCard" aria-labelledby={`h-auto-${network}`}>
      <div className="liHead">
        <NetworkIcon id={network} size={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <div className="eyebrow" style={{ fontSize: 11 }}>Publicação automática</div>
          <h2 id={`h-auto-${network}`} style={{ fontSize: 18 }}>{info.nome}</h2>
          {state.kind === 'conectado' ? (
            <span className="status" style={{ color: 'var(--done-ink)' }}>
              <span className="dot" style={{ background: 'var(--teal)' }} />
              Conectado como {state.name || 'você'}
              {state.detail ? ` · ${state.detail}` : ''}
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>{state.kind === 'indisponivel' ? 'Em configuração. Em breve você conecta com um clique.' : info.pitch}</span>
          )}
        </div>
        {state.kind === 'conectado' && state.picture && <img src={state.picture} alt="" className="liPic" />}
      </div>

      {f && <div role="status" className={f.ok ? 'formOk' : 'formError'}>{f.text}</div>}

      {state.kind === 'conectado' && (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {state.daysLeft <= 10 ? (
            <b style={{ color: 'var(--error-ink)' }}>A conexão vence em {state.daysLeft} {state.daysLeft === 1 ? 'dia' : 'dias'}. </b>
          ) : (
            <>Conexão válida até {new Date(state.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. </>
          )}
          {info.renew}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {state.kind === 'desconectado' && <a className="btn3d btnSm" href={connectHref}>Conectar {info.nome}</a>}
        {state.kind === 'conectado' && (
          <>
            <a className="btnGhost btnSm" href={connectHref}>Reconectar</a>
            {confirm ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 13 }}>Os agendamentos do {info.nome} serão cancelados.</span>
                <button
                  type="button"
                  className="btnGhost btnSm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await disconnectNetwork(network);
                      setConfirm(false);
                      router.replace('/app/redes');
                      router.refresh();
                    })
                  }
                >
                  {pending ? 'Desconectando…' : 'Desconectar'}
                </button>
                <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => setConfirm(false)}>Cancelar</button>
              </span>
            ) : (
              <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => setConfirm(true)}>Desconectar</button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
