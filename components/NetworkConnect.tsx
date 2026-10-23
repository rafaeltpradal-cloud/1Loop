'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NetworkIcon } from '@/components/NetworkIcon';
import { disconnectNetwork, requestInstagramInvite } from '@/app/app/redes/actions';

export type ConnectState =
  | { kind: 'indisponivel' }
  | { kind: 'desconectado' }
  | { kind: 'conectado'; name: string; picture: string | null; expiresAt: string; daysLeft: number; detail?: string; missingInsights?: boolean };

type Net = 'linkedin' | 'instagram';
type Step = { title: string; body: React.ReactNode };

const INFO: Record<Net, { nome: string; renew: string; steps: Step[] }> = {
  linkedin: {
    nome: 'LinkedIn',
    renew: 'O LinkedIn pede para renovar a autorização a cada 60 dias: é só clicar em Reconectar.',
    steps: [
      { title: 'Entre com o seu LinkedIn', body: 'Use o perfil pessoal onde os posts vão sair.' },
      { title: 'Autorize a publicação', body: 'Na tela do LinkedIn, clique em Permitir.' },
      { title: 'Pronto', body: 'Os posts agendados saem sozinhos no horário.' },
    ],
  },
  instagram: {
    nome: 'Instagram',
    renew: 'A conexão com o Instagram é renovada automaticamente.',
    steps: [
      {
        title: 'Use uma conta profissional',
        body: (
          <>
            Conta pessoal não conecta. No app do Instagram: <b>Perfil → ☰ → Tipo de conta e ferramentas → Mudar para conta profissional</b>. É grátis e leva 1 minuto.
          </>
        ),
      },
      { title: 'Conecte e autorize', body: 'Entre com a conta e deixe todas as permissões marcadas: publicar e ler os números.' },
      { title: 'Pronto', body: 'Agende imagens, carrosséis, reels e stories e acompanhe em Desempenho.' },
    ],
  },
};

const FLASH: Record<string, (n: string) => { ok: boolean; text: string }> = {
  conectado: (n) => ({ ok: true, text: `${n} conectado. Agora você pode agendar os posts do ${n} em Conteúdos.` }),
  cancelado: (n) => ({ ok: false, text: `Você cancelou a autorização no ${n}. Pode tentar de novo quando quiser.` }),
  erro: (n) => ({ ok: false, text: `Não deu para conectar o ${n}. Tente de novo.` }),
  indisponivel: (n) => ({ ok: false, text: `A conexão com o ${n} ainda está sendo configurada.` }),
  pessoal: () => ({ ok: false, text: 'Essa conta do Instagram é pessoal. Mude para conta profissional (passo 1) e conecte de novo.' }),
};

export function NetworkConnect({
  network,
  state,
  flash,
  inviteOnly = false,
  savedHandle,
}: {
  network: Net;
  state: ConnectState;
  flash?: string;
  /** Instagram em análise na Meta: só contas convidadas conectam. */
  inviteOnly?: boolean;
  savedHandle?: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const info = INFO[network];
  const f = flash && FLASH[flash] ? FLASH[flash](info.nome) : undefined;
  const connectHref = `/api/${network}/conectar`;

  return (
    <section className="card liCard" aria-labelledby={`h-auto-${network}`}>
      <div className="liHead">
        <NetworkIcon id={network} size={40} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <h2 id={`h-auto-${network}`} style={{ fontSize: 16 }}>{info.nome}</h2>
          {state.kind === 'conectado' ? (
            <span className="status" style={{ color: 'var(--done-ink)' }}>
              <span className="dot" style={{ background: 'var(--teal)' }} />
              Conectado como {state.name || 'você'}
              {state.detail ? ` · ${state.detail}` : ''}
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>{state.kind === 'indisponivel' ? 'Em configuração.' : 'Publicação automática'}</span>
          )}
        </div>
        {state.kind === 'conectado' && state.picture && <img src={state.picture} alt="" className="liPic" />}
      </div>

      {f && <div role="status" className={f.ok ? 'formOk' : 'formError'}>{f.text}</div>}

      {state.kind === 'desconectado' && (
        <ol className="connSteps">
          {info.steps.map((s, i) => (
            <li key={s.title}>
              <span className="connNum" aria-hidden="true">{i + 1}</span>
              <span>
                <b>{s.title}</b>
                <span className="muted">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      {state.kind === 'desconectado' && inviteOnly && <InviteGate connectHref={connectHref} savedHandle={savedHandle} />}

      {state.kind === 'conectado' && state.missingInsights && (
        <div className="formNote" role="status">
          Falta autorizar a leitura dos números. Clique em <b>Reconectar</b> para ver este perfil em Desempenho.
        </div>
      )}

      {state.kind === 'conectado' && (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {state.daysLeft <= 10 ? (
            <b style={{ color: 'var(--error-ink)' }}>A conexão vence em {state.daysLeft} {state.daysLeft === 1 ? 'dia' : 'dias'}. </b>
          ) : (
            <>Válida até {new Date(state.expiresAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. </>
          )}
          {info.renew}
        </p>
      )}

      <div className="liActions">
        {state.kind === 'desconectado' && !inviteOnly && <a className="btn3d btnSm" href={connectHref}>Conectar {info.nome}</a>}
        {state.kind === 'conectado' && (
          <>
            <a className={state.missingInsights ? 'btn3d btnSm' : 'btnGhost btnSm'} href={connectHref}>Reconectar</a>
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
                <button type="button" className="linkBtn" onClick={() => setConfirm(false)}>Cancelar</button>
              </span>
            ) : (
              <button type="button" className="linkBtn" onClick={() => setConfirm(true)}>Desconectar</button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** Enquanto a Meta analisa o 1loop, o Instagram conecta só por convite. */
function InviteGate({ connectHref, savedHandle }: { connectHref: string; savedHandle?: string }) {
  const [handle, setHandle] = useState(savedHandle ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="inviteBox">
      <p>
        <b>Acesso antecipado.</b> Enquanto a Meta analisa o 1loop, o Instagram conecta só para contas convidadas. Peça o seu convite: liberamos em até 1 dia útil e avisamos por e-mail.
      </p>
      {msg?.ok ? (
        <div className="formOk" role="status">{msg.text}</div>
      ) : (
        <form
          className="inviteForm"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await requestInstagramInvite(handle);
              setMsg(r.ok ? { ok: true, text: 'Pedido enviado. Quando o convite chegar, aceite no Instagram e volte aqui para conectar.' } : { ok: false, text: r.error ?? 'Não deu certo.' });
            });
          }}
        >
          <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@seuperfil" aria-label="Seu @ no Instagram" maxLength={60} />
          <button type="submit" className="btn3d btnSm" disabled={pending || handle.trim().length < 2}>
            {pending ? 'Enviando…' : 'Pedir convite'}
          </button>
        </form>
      )}
      {msg && !msg.ok && <div className="formError" role="alert">{msg.text}</div>}
      <details className="inviteHow">
        <summary>Já recebi o convite</summary>
        <span className="muted">
          No navegador, abra <b>instagram.com → Configurações → Apps e sites → Convites de testador</b> e aceite o do 1Loop Creators. Depois:
        </span>
        <a className="btn3d btnSm" href={connectHref} style={{ alignSelf: 'flex-start' }}>Conectar Instagram</a>
      </details>
    </div>
  );
}
