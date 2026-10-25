'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { disconnectLinkedInPages, setLinkedInTarget } from '@/app/app/redes/actions';

export type PagesState =
  | { kind: 'indisponivel' }
  | { kind: 'desconectado'; personName?: string }
  | { kind: 'conectado'; orgs: { id: string; name: string }[]; selected: string; active: boolean; personName?: string };

// Escolha de onde saem os posts do LinkedIn: perfil pessoal ou página da empresa.
export function LinkedInPages({ state }: { state: PagesState }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const current = state.kind === 'conectado' && state.active ? state.selected : 'perfil';

  function choose(target: string) {
    setError('');
    start(async () => {
      const r = await setLinkedInTarget(target);
      if (!r.ok) setError(r.error ?? 'Não deu certo.');
      router.refresh();
    });
  }

  return (
    <section className="card liPages" aria-labelledby="h-li-pages">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 id="h-li-pages" style={{ fontSize: 16 }}>Página da empresa no LinkedIn</h2>
        <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
          {state.kind === 'indisponivel'
            ? 'Publicar direto na página da sua empresa está em liberação pelo LinkedIn. Assim que liberar, a opção aparece aqui.'
            : 'Escolha onde os posts do LinkedIn desta marca vão sair: no seu perfil ou numa página que você administra.'}
        </span>
      </div>

      {state.kind === 'desconectado' && (
        <a className="btn3d btnSm" href="/api/linkedin/paginas/conectar" style={{ alignSelf: 'flex-start' }}>Conectar página</a>
      )}

      {state.kind === 'conectado' && (
        <>
          <div className="liTargets" role="radiogroup" aria-label="Onde publicar">
            <button type="button" role="radio" aria-checked={current === 'perfil'} className={`liTarget ${current === 'perfil' ? 'on' : ''}`} onClick={() => choose('perfil')} disabled={pending}>
              <b>Meu perfil</b>
              <span className="muted">{state.personName || 'Perfil pessoal conectado acima'}</span>
            </button>
            {state.orgs.map((o) => (
              <button key={o.id} type="button" role="radio" aria-checked={current === o.id} className={`liTarget ${current === o.id ? 'on' : ''}`} onClick={() => choose(o.id)} disabled={pending}>
                <b>{o.name}</b>
                <span className="muted">Página da empresa</span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <a className="btnGhost btnSm" href="/api/linkedin/paginas/conectar">Atualizar páginas</a>
            <button
              type="button"
              className="linkBtn"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await disconnectLinkedInPages();
                  router.refresh();
                })
              }
            >
              Desconectar páginas
            </button>
          </div>
        </>
      )}
      {error && <div className="formError" role="alert">{error}</div>}
    </section>
  );
}
