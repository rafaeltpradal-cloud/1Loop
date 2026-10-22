'use client';

import { useActionState } from 'react';
import { signUp, type FormState } from '../actions';
import type { PlanId } from '@/lib/plans';

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function SignUpForm({ plan }: { plan: PlanId }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, undefined);

  return (
    <form action={action} className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 18 }} noValidate>
      <input type="hidden" name="plano" value={plan} />
      {state?.error && <div className="formError" role="alert">{state.error}</div>}
      {state?.note && <div className="formNote" role="status">{state.note}</div>}

      <div className="field">
        <label htmlFor="nome">Nome completo</label>
        <input id="nome" name="nome" type="text" autoComplete="name" required placeholder="Como você assina seus conteúdos" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18 }}>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com" />
        </div>
        <div className="field">
          <label htmlFor="telefone">Telefone (WhatsApp)</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            placeholder="(11) 91234-5678"
            onChange={(e) => {
              e.currentTarget.value = maskPhone(e.currentTarget.value);
            }}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} placeholder="Pelo menos 8 caracteres" />
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)', cursor: 'pointer' }}>
        <input type="checkbox" name="termos" style={{ width: 20, height: 20, marginTop: 1 }} />
        <span>Li e aceito os <a href="/termos" target="_blank">termos de uso</a> e a <a href="/privacidade" target="_blank">política de privacidade</a>.</span>
      </label>
      <button className="btn3d" type="submit" disabled={pending}>{pending ? 'Criando sua conta…' : 'Continuar para o pagamento'}</button>
    </form>
  );
}
