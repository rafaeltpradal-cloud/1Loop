'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrand, deleteBrand, renameBrand, switchBrand } from './actions';

export type BrandInfo = { id: number; name: string; locked: boolean; interview: boolean; strategy: boolean; networks: string[] };

function status(b: BrandInfo) {
  const step = !b.interview ? 'Falta a entrevista' : !b.strategy ? 'Falta gerar a estratégia' : 'Estratégia pronta';
  return `${step} · ${b.networks.length ? `Conectada: ${b.networks.join(', ')}` : 'nenhuma rede conectada'}`;
}

export function BrandManager({ brands, current, limit }: { brands: BrandInfo[]; current: number; limit: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const canCreate = brands.length < limit;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    start(async () => {
      setMsg(null);
      const r = await fn();
      if (!r.ok) return setMsg({ kind: 'error', text: r.error ?? 'Não deu certo.' });
      after?.();
      router.refresh();
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="brandList">
        {brands.map((b) => {
          const on = b.id === current;
          return (
            <div key={b.id} className={on ? 'brandRow on' : 'brandRow'}>
              {editing === b.id ? (
                <form
                  className="brandRowMain"
                  style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => renameBrand(b.id, draft), () => setEditing(null));
                  }}
                >
                  <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={60} autoFocus aria-label="Nome da marca" style={{ flex: '1 1 200px' }} />
                  <button className="btn3d btnSm" type="submit" disabled={pending}>Salvar</button>
                  <button className="linkBtn" type="button" onClick={() => setEditing(null)}>Cancelar</button>
                </form>
              ) : (
                <>
                  <div className="brandRowMain">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 16 }}>{b.name}</b>
                      {on && <span className="brandTag on">Em uso</span>}
                      {b.locked && <span className="brandTag">Bloqueada no seu plano</span>}
                    </span>
                    <span className="muted" style={{ fontSize: 13 }}>{status(b)}</span>
                  </div>
                  <div className="brandRowActs">
                    {!on && !b.locked && (
                      <button type="button" className="btnGhost btnSm" disabled={pending} onClick={() => run(() => switchBrand(b.id), () => router.push('/app'))}>
                        Usar esta
                      </button>
                    )}
                    <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => (setEditing(b.id), setDraft(b.name), setRemoving(null))}>
                      Renomear
                    </button>
                    {brands.length > 1 && (
                      <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => (setRemoving(b.id), setConfirm(''), setEditing(null))}>
                        Apagar
                      </button>
                    )}
                  </div>
                </>
              )}
              {removing === b.id && (
                <form
                  style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => deleteBrand(b.id, confirm), () => setRemoving(null));
                  }}
                >
                  <span className="formError" style={{ fontWeight: 600 }}>
                    Isso apaga a entrevista, as estratégias, os conteúdos, as redes conectadas e a biblioteca de “{b.name}”. Não dá para desfazer.
                  </span>
                  <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Digite ${b.name} para confirmar`} aria-label="Confirmar nome" style={{ flex: '1 1 220px' }} />
                    <button className="btnGhost btnSm" type="submit" disabled={pending || confirm.trim().toLowerCase() !== b.name.toLowerCase()}>
                      Apagar marca
                    </button>
                    <button className="linkBtn" type="button" onClick={() => setRemoving(null)}>Cancelar</button>
                  </span>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {limit > 1 && (
        <form
          className="card"
          style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createBrand(name),
              () => {
                setName('');
                router.push('/app/entrevista');
              },
            );
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b style={{ fontSize: 16 }}>Nova marca</b>
            <span className="muted" style={{ fontSize: 13 }}>
              {canCreate
                ? `Você usa ${brands.length} de ${limit}. A nova marca começa pela entrevista, do zero.`
                : `Você já usa as ${limit} marcas do seu plano. Apague uma para criar outra.`}
            </span>
          </div>
          {canCreate && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: 1loop creators, Studio Ana, Cliente X" aria-label="Nome da nova marca" style={{ flex: '1 1 240px' }} />
              <button className="btn3d btnSm" type="submit" disabled={pending || name.trim().length < 2}>
                {pending ? 'Criando…' : 'Criar e fazer a entrevista'}
              </button>
            </div>
          )}
        </form>
      )}

      {msg && (
        <div role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'formError' : 'formNote'}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
