'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NetworkIcon } from '@/components/NetworkIcon';
import { disconnectLinkedIn } from '@/app/app/redes/actions';

export type LinkedInState =
  | { kind: 'indisponivel' }
  | { kind: 'desconectado' }
  | { kind: 'conectado'; name: string; picture: string | null; expiresAt: string; daysLeft: number };

const FLASH: Record<string, { ok: boolean; text: string }> = {
  conectado: { ok: true, text: 'LinkedIn conectado. Agora você pode agendar os posts do LinkedIn em Conteúdos.' },
  cancelado: { ok: false, text: 'Você cancelou a autorização no LinkedIn. Pode tentar de novo quando quiser.' },
  erro: { ok: false, text: 'Não deu para conectar o LinkedIn. Tente de novo.' },
  indisponivel: { ok: false, text: 'A conexão com o LinkedIn ainda está sendo configurada.' },
};

export function LinkedInConnect({ state, flash }: { state: LinkedInState; flash?: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const f = flash ? FLASH[flash] : undefined;

  return (
    <section className="card liCard" aria-labelledby="h-auto">
      <div className="liHead">
        <NetworkIcon id="linkedin" size={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <div className="eyebrow" style={{ fontSize: 11 }}>Publicação automática</div>
          <h2 id="h-auto" style={{ fontSize: 18 }}>LinkedIn</h2>
          {state.kind === 'conectado' ? (
            <span className="status" style={{ color: 'var(--done-ink)' }}>
              <span className="dot" style={{ background: 'var(--teal)' }} />
              Conectado como {state.name || 'você'}
            </span>
          ) : (
            <span className="muted" style={{ fontSize: 13 }}>
              {state.kind === 'indisponivel' ? 'Em configuração. Em breve você conecta com um clique.' : 'Conecte uma vez e agende os posts do LinkedIn para saírem sozinhos no horário.'}
            </span>
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
          O LinkedIn pede para renovar a autorização a cada 60 dias. É só clicar em Reconectar.
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {state.kind === 'desconectado' && <a className="btn3d btnSm" href="/api/linkedin/conectar">Conectar LinkedIn</a>}
        {state.kind === 'conectado' && (
          <>
            <a className="btnGhost btnSm" href="/api/linkedin/conectar">Reconectar</a>
            {confirm ? (
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="muted" style={{ fontSize: 13 }}>Os agendamentos do LinkedIn serão cancelados.</span>
                <button
                  type="button"
                  className="btnGhost btnSm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await disconnectLinkedIn();
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
