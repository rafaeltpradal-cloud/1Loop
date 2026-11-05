import Link from 'next/link';
import { Brand, LoopMark, Wordmark } from '@/components/Logo';
import { AppNav } from '@/components/AppNav';
import { Avatar } from '@/components/Avatar';
import { BrandSwitcher } from '@/components/BrandSwitcher';
import { getPreviewContext as getAppContext } from '@/lib/session';
import { PLANS } from '@/lib/plans';
import { PreviewBar } from '@/components/PreviewBar';
import { createAdminClient } from '@/lib/supabase/admin';

// Contato do "Falar com a gente": WhatsApp se o número estiver configurado na Vercel, senão e-mail.
const SUPPORT = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
const supportHref = SUPPORT.length >= 10 ? `https://wa.me/${SUPPORT}?text=${encodeURIComponent('Oi! Uso o 1loop creators e tenho uma dúvida.')}` : 'mailto:contato@1loopcreators.com.br?subject=D%C3%BAvida%20no%201loop';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const plan = PLANS[ctx.plan];
  const multi = ctx.brandLimit > 1 || ctx.brands.length > 1;
  // Primeiros passos e posts para revisar (contador no menu).
  const admin = createAdminClient();
  const [{ data: postRows }, { count: conns }] = await Promise.all([
    admin.from('posts').select('status, date').eq('user_id', ctx.userId).eq('brand_id', ctx.brandId).limit(1000),
    admin.from('social_connections').select('network', { count: 'exact', head: true }).eq('user_id', ctx.userId).eq('brand_id', ctx.brandId),
  ]);
  const statuses = (postRows ?? []).map((p) => p.status as string);
  // Contador do menu: rascunhos que ainda vão sair (de hoje em diante).
  const today = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
  const drafts = (postRows ?? []).filter((p) => p.status === 'rascunho' && (p.date as string) >= today).length;
  const firstSteps = [ctx.hasStrategy, statuses.length > 0, (conns ?? 0) > 0, statuses.includes('publicado') || statuses.includes('agendado')];
  const stepsDone = firstSteps.filter(Boolean).length;
  const switcher = (compact?: boolean) => <BrandSwitcher current={ctx.brandId} brands={ctx.brands} limit={ctx.brandLimit} compact={compact} />;

  return (
    <div className="shell">
      {/* Celular: barra de cima com marca, configurações e perfil */}
      <header className="mobileBar">
        <Link href="/app" aria-label="1loop creators — início" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', minHeight: 44 }}>
          <LoopMark size={30} />
          {!multi && <Wordmark size={18} />}
        </Link>
        {multi && switcher(true)}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href={ctx.preview || ctx.freeTrial || ctx.testPost ? '/app/assinar' : '/app/plano'} className="mobilePlan">
            <span className="dot" style={{ background: ctx.preview ? 'var(--amber, #F08A24)' : ctx.status === 'trialing' || ctx.freeTrial || ctx.testPost ? 'var(--violet)' : 'var(--teal)' }} />
            {ctx.preview ? 'Assinar' : ctx.testPost ? 'Post de teste' : ctx.freeTrial ? `Teste · ${ctx.trialDaysLeft ?? 0}d` : plan.name}
          </Link>
          <Link href="/app/configuracoes" className="mobileIconBtn" aria-label="Configurações">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </Link>
          <Link href="/app/perfil" aria-label="Seu perfil" style={{ display: 'inline-flex', minHeight: 44, alignItems: 'center' }}>
            <Avatar name={ctx.name} url={ctx.avatarUrl} size={34} />
          </Link>
        </div>
      </header>

      <aside className="sidebar">
        <Brand href="/app" />
        {multi && switcher()}
        {stepsDone < firstSteps.length && (
          <Link href="/app" className="navProgress">
            <span className="navProgressHead"><b>Primeiros passos</b><span>{stepsDone} de {firstSteps.length}</span></span>
            <span className="navProgressBar" aria-hidden="true"><span style={{ width: `${(stepsDone / firstSteps.length) * 100}%` }} /></span>
          </Link>
        )}
        <AppNav group="main" counts={{ drafts }} />
        <div className="sidebarFoot">
          <AppNav group="account" />
          <Link href={ctx.preview || ctx.freeTrial || ctx.testPost ? '/app/assinar' : '/app/plano'} className="card planCard footExtra" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'none', textDecoration: 'none', color: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
              <span className="dot" style={{ background: ctx.preview ? 'var(--amber, #F08A24)' : ctx.status === 'trialing' || ctx.freeTrial || ctx.testPost ? 'var(--violet)' : 'var(--teal)' }} />
              {ctx.preview ? (ctx.market === 'pt' ? 'Teste terminado' : 'Teste encerrado') : ctx.testPost ? 'Post de teste' : ctx.freeTrial ? 'Teste grátis' : `Plano ${plan.name}`}
              <span className="planCardGo" aria-hidden="true">›</span>
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              {ctx.preview
                ? 'Assinar para continuar'
                : ctx.testPost
                  ? 'Publique-o e depois assine'
                : ctx.freeTrial
                  ? `${ctx.trialDaysLeft ?? 0} ${ctx.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'} · sem cartão`
                : ctx.trialDaysLeft !== null
                  ? `Teste: ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia restante' : 'dias restantes'}`
                  : plan.rhythm}
              {!ctx.preview && !ctx.freeTrial && !ctx.testPost && ctx.plan !== 'multi' ? ' · fazer upgrade' : ''}
            </span>
            {ctx.trialDaysLeft !== null && (
              <span className="navProgressBar" aria-hidden="true"><span style={{ width: `${Math.max(4, ((7 - Math.min(7, ctx.trialDaysLeft)) / 7) * 100)}%` }} /></span>
            )}
          </Link>
          <a href={supportHref} target="_blank" rel="noreferrer" className="navHelp footExtra">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12Z" /></svg>
            Falar com a gente
          </a>
          <div className="footExtra" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Link href="/app/perfil" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, textDecoration: 'none' }}>
              <Avatar name={ctx.name} url={ctx.avatarUrl} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.name}</span>
                <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ctx.email}</span>
              </span>
            </Link>
            <form action="/auth/sair" method="post">
              <button className="linkBtn" type="submit" style={{ fontSize: 13 }}>Sair</button>
            </form>
          </div>
        </div>
      </aside>
      <main className="content">
        {ctx.preview && <PreviewBar userId={ctx.userId} plan={ctx.plan} market={ctx.market} />}
        {ctx.freeTrial && (ctx.trialDaysLeft ?? 9) <= 2 && (
          <div className="previewBar" role="note">
            <div className="previewBarText">
              <b>{ctx.trialDaysLeft === 0 ? 'Seu teste grátis acaba hoje' : `Seu teste grátis acaba em ${ctx.trialDaysLeft} ${ctx.trialDaysLeft === 1 ? 'dia' : 'dias'}`}</b>
              <span>Assine para não parar de aparecer: seus posts agendados continuam saindo.</span>
            </div>
            <Link className="btn3d btnSm" href="/app/assinar">Assinar</Link>
          </div>
        )}
        {children}
      </main>
      <AppNav group="tabs" counts={{ drafts }} />
    </div>
  );
}
