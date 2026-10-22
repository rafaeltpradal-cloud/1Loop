'use client';

import { useActionState } from 'react';
import { updatePassword, type PasswordState } from './actions';

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(updatePassword, undefined);
  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
      {state?.error && <div className="formError" role="alert">{state.error}</div>}
      {state?.ok && <div className="formOk" role="status">Senha alterada.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="field">
          <label htmlFor="senha">Nova senha</label>
          <input id="senha" name="senha" type="password" autoComplete="new-password" minLength={8} placeholder="Pelo menos 8 caracteres" />
        </div>
        <div className="field">
          <label htmlFor="confirmar">Repita a nova senha</label>
          <input id="confirmar" name="confirmar" type="password" autoComplete="new-password" minLength={8} />
        </div>
      </div>
      <div>
        <button className="btnGhost btnSm" type="submit" disabled={pending}>{pending ? 'Salvando…' : 'Trocar senha'}</button>
      </div>
    </form>
  );
}
