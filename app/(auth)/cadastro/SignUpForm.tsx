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
        <label htmlFor="nome">Seu nome</label>
        <input id="nome" name="nome" type="text" autoComplete="name" required placeholder="Como você assina seus posts" />
      </div>
      <div className="field">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="voce@empresa.com" />
      </div>
      <div className="field">
        <label htmlFor="senha">Crie uma senha</label>
        <input id="senha" name="senha" type="password" autoComplete="new-password" required minLength={8} placeholder="Pelo menos 8 caracteres" />
      </div>
      <details className="optField">
        <summary>Quer receber dicas pelo WhatsApp? (opcional)</summary>
        <div className="field">
          <label htmlFor="telefone">WhatsApp</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="(11) 91234-5678"
            onChange={(e) => {
              e.currentTarget.value = maskPhone(e.currentTarget.value);
            }}
          />
        </div>
      </details>
      <input type="hidden" name="termos" value="on" />
      <button className="btn3d" type="submit" disabled={pending} style={{ justifyContent: 'center' }}>{pending ? 'Criando sua conta…' : 'Criar conta grátis e ver minha estratégia'}</button>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
        Sem cartão. Ao criar a conta você aceita os <a href="/termos" target="_blank">termos de uso</a> e a <a href="/privacidade" target="_blank">política de privacidade</a>.
      </p>
    </form>
  );
}
