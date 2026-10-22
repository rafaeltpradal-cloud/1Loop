'use client';

import { useActionState } from 'react';
import { signIn, type FormState } from '../actions';

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, undefined);
  return (
    <form action={action} className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <input type="hidden" name="next" value={next} />
      {state?.error && <div className="formError" role="alert">{state.error}</div>}
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required />
      </div>
      <button className="btn3d" type="submit" disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
