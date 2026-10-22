'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NETWORKS, type NetworkId } from '@/lib/networks';
import { removeHandle, saveHandle } from './actions';

type Saved = Partial<Record<NetworkId, { handle: string; status: string }>>;

function NetworkCard({ id, chosen, saved }: { id: NetworkId; chosen: boolean; saved?: { handle: string; status: string } }) {
  const n = NETWORKS.find((x) => x.id === id)!;
  const router = useRouter();
  const [editing, setEditing] = useState(!saved);
  const [value, setValue] = useState(saved?.handle ?? '');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function save() {
    setError('');
    start(async () => {
      const res = await saveHandle(id, value);
      if (!res.ok) return setError(res.error ?? 'Não deu certo.');
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    start(async () => {
      await removeHandle(id);
      setValue('');
      setEditing(true);
      router.refresh();
    });
  }

  return (
    <li className="card netCard" style={{ boxShadow: 'none', borderColor: chosen ? 'var(--line-2)' : 'var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="netBadge" style={{ background: n.color }} aria-hidden="true">{n.short}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <b style={{ fontSize: 16 }}>{n.name}</b>
          {chosen ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)' }}>Na sua estratégia</span> : <span className="muted" style={{ fontSize: 12 }}>Opcional</span>}
        </div>
      </div>

      {saved && !editing ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.prefix}{saved.handle}</span>
            <span className="status" style={{ color: 'var(--done-ink)' }}><span className="dot" style={{ background: 'var(--teal)' }} />Perfil cadastrado</span>
            <span className="muted" style={{ fontSize: 12 }}>Publicação automática: em breve</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="button" className="btnGhost btnSm" onClick={() => { setValue(saved.handle); setEditing(true); }} disabled={pending}>Editar</button>
            <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={remove} disabled={pending}>Remover</button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div className="field">
            <label htmlFor={`h-${id}`}>Seu perfil</label>
            <input id={`h-${id}`} type="text" value={value} placeholder={n.placeholder} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
          </div>
          {error && <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--error-ink)' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="btnGhost btnSm" disabled={pending || value.trim().length < 2}>{pending ? 'Salvando…' : 'Salvar perfil'}</button>
            {saved && (
              <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => { setValue(saved.handle); setEditing(false); }}>Cancelar</button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}

export function NetworksBoard({ chosen, saved }: { chosen: NetworkId[]; saved: Saved }) {
  const order = [...chosen, ...NETWORKS.map((n) => n.id).filter((id) => !chosen.includes(id))];
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {order.map((id) => (
        <NetworkCard key={id} id={id} chosen={chosen.includes(id)} saved={saved[id]} />
      ))}
    </ul>
  );
}
