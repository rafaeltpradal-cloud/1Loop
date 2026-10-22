'use client';

import { useActionState } from 'react';
import { updateProfile, type ProfileState } from './actions';
import { maskPhone } from '@/lib/phone';

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, undefined);

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
      {state?.error && <div className="formError" role="alert">{state.error}</div>}
      {state?.ok && <div className="formOk" role="status">Dados salvos.</div>}
      <div className="field">
        <label htmlFor="nome">Nome</label>
        <input id="nome" name="nome" type="text" autoComplete="name" defaultValue={name} required />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} disabled readOnly />
        </div>
        <div className="field">
          <label htmlFor="telefone">Telefone (WhatsApp)</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            defaultValue={maskPhone(phone)}
            onChange={(e) => {
              e.currentTarget.value = maskPhone(e.currentTarget.value);
            }}
          />
        </div>
      </div>
      <div>
        <button className="btn3d" type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Salvar dados'}</button>
      </div>
    </form>
  );
}
