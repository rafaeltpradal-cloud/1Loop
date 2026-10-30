import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
import { isPlanId, PLANS } from '@/lib/plans';
import { SignUpForm } from './SignUpForm';

export const metadata = { title: 'Criar conta grátis · 1loop creators' };

// Cadastro sem cartão: a pessoa cria a conta, responde 5 perguntas e vê a estratégia e o primeiro post.
// O plano só é escolhido no fim da prévia, então aqui não aparece preço.
export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const plan = PLANS[isPlanId(plano) ? plano : 'pro'];

  return (
    <PublicShell right={<span className="muted" style={{ fontSize: 14 }}>Já tem conta? <Link href="/entrar">Entrar</Link></span>}>
      <div className="signupWrap">
        <div style={{ flex: '999 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{ fontSize: 'clamp(28px, 3.4vw, 40px)', lineHeight: 1.1, letterSpacing: '-1px' }}>
              <span className="graphite">Seu primeiro post pronto</span> <span className="grad">em 2 minutos.</span>
            </h1>
            <p className="muted" style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>Grátis e sem cartão. Crie a conta, responda 5 perguntas e veja sua estratégia de 30 dias.</p>
          </div>
          <SignUpForm plan={plan.id} />
        </div>

        <aside className="card signupAside">
          <div className="eyebrow">O que você recebe agora, grátis</div>
          <ol className="signupSteps">
            <li><b>5 perguntas rápidas</b><span>O que você vende, para quem e o seu tom.</span></li>
            <li><b>Estratégia de 30 dias</b><span>Pilares, calendário e o que postar em cada dia.</span></li>
            <li><b>Seu primeiro post pronto</b><span>Texto e imagem na sua voz, para o LinkedIn.</span></li>
          </ol>
          <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>Gostou? Aí sim você escolhe um plano e testa 7 dias grátis com publicação automática.</p>
        </aside>
      </div>
    </PublicShell>
  );
}
