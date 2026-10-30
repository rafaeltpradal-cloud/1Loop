import type { Metadata } from 'next';
import Link from 'next/link';
import { LoopMark, Wordmark } from '@/components/Logo';
import { LandingInteractions } from '../_landing/LandingInteractions';
import { FOUNDERS_ENDS_LABEL, foundersCountdown, foundersOpen, priceNow } from '@/lib/founders';
import { PLANS } from '@/lib/plans';

// Página dos anúncios (vendedores). Enxuta de propósito: carrega rápido no navegador do Instagram,
// uma promessa, um botão (cadastro sem cartão) e as respostas para as dúvidas que travam o clique.

export const metadata: Metadata = {
  title: '1loop creators · Autoridade no LinkedIn para quem vende',
  description: 'Responda 5 perguntas e receba sua estratégia de 30 dias e posts prontos na sua voz. Grátis e sem cartão.',
  alternates: { canonical: '/vendedores' },
};

export const dynamic = 'force-dynamic';

const CTA = '/cadastro?plano=pro';

const CSS = `
.vp{--ink:#0E0F12;--muted:#5E646C;--line:#E3E6EA;--bg:#F4F5F7;--blue:#0A66C2;--violet:#7C4DFF;font-family:var(--font-manrope),Manrope,system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh}
.vp *{box-sizing:border-box}
.vpWrap{max-width:1080px;margin:0 auto;padding:0 20px}
.vpHead{display:flex;align-items:center;justify-content:space-between;padding:14px 0}
.vpHead a{color:var(--muted);font-weight:700;font-size:14px;text-decoration:none}
.vpBrand{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.vpHero{display:grid;grid-template-columns:1.05fr .95fr;gap:40px;align-items:center;padding:28px 0 56px}
.vpEyebrow{display:inline-flex;gap:8px;align-items:center;font-size:13px;font-weight:800;letter-spacing:.4px;color:var(--blue);background:rgba(10,102,194,.08);padding:6px 12px;border-radius:999px}
.vpH1{font-size:clamp(34px,5.2vw,56px);line-height:1.04;letter-spacing:-1.6px;margin:16px 0 14px;font-weight:800}
.vpH1 em{font-style:normal;background:linear-gradient(90deg,#0A66C2,#7C4DFF);-webkit-background-clip:text;background-clip:text;color:transparent}
.vpSub{font-size:18px;line-height:1.55;color:var(--muted);margin:0 0 22px;max-width:520px}
.vpBtn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:56px;padding:0 28px;border-radius:14px;background:#0E0F12;color:#fff;font-weight:800;font-size:17px;text-decoration:none;box-shadow:0 10px 24px rgba(14,15,18,.18)}
.vpBtn:hover{transform:translateY(-1px)}
.vpMicro{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:13.5px;font-weight:700;color:var(--muted)}
.vpMicro span::before{content:"✓ ";color:#12A594}
.vpPost{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 24px 50px rgba(14,15,18,.08);font-size:14.5px;line-height:1.55}
.vpPostHead{display:flex;gap:10px;align-items:center;margin-bottom:12px}
.vpAv{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0A66C2,#7C4DFF);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800}
.vpPostHead b{display:block;font-size:14.5px}.vpPostHead small{color:var(--muted);font-size:12.5px}
.vpPost p{margin:0 0 10px}
.vpTag{display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:var(--violet);background:rgba(124,77,255,.08);padding:4px 10px;border-radius:999px}
.vpSec{padding:48px 0;border-top:1px solid var(--line)}
.vpH2{font-size:clamp(26px,3.4vw,38px);letter-spacing:-1px;line-height:1.1;margin:0 0 22px;font-weight:800}
.vpGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.vpCard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px}
.vpCard b{display:block;font-size:17px;margin-bottom:6px}.vpCard p{margin:0;color:var(--muted);font-size:15px;line-height:1.55}
.vpNum{width:32px;height:32px;border-radius:10px;background:#0E0F12;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:800;margin-bottom:10px}
.vpFaq details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:10px}
.vpFaq summary{cursor:pointer;font-weight:800;font-size:16px}
.vpFaq p{margin:10px 0 0;color:var(--muted);line-height:1.6}
.vpFinal{text-align:center;padding:56px 0 110px}
.vpFounders{display:inline-flex;gap:8px;align-items:center;margin-top:14px;font-size:14px;font-weight:700;color:#8A4B00;background:rgba(240,138,36,.12);padding:8px 14px;border-radius:12px}
.vpSticky{display:none}
@media (max-width:860px){
  .vpHero{grid-template-columns:1fr;gap:28px;padding-top:14px}
  .vpGrid{grid-template-columns:1fr}
  .vpSub{font-size:16.5px}
  .vpHero .vpBtn{width:100%}
  .vpSticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:20;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:rgba(244,245,247,.94);backdrop-filter:blur(8px);border-top:1px solid var(--line)}
  .vpSticky .vpBtn{width:100%;min-height:52px;font-size:16px}
}
`;

export default function SalesLandingPage() {
  const founders = foundersOpen();
  const pro = PLANS.pro;
  return (
    <div className="vp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="vpWrap">
        <header className="vpHead">
          <Link href="/" className="vpBrand" aria-label="1loop creators">
            <LoopMark size={30} />
            <Wordmark size={18} />
          </Link>
          <Link href="/entrar">Entrar</Link>
        </header>

        <section className="vpHero">
          <div>
            <span className="vpEyebrow">Para quem vive de vender</span>
            <h1 className="vpH1">
              Você sabe vender. <em>Falta o LinkedIn saber disso.</em>
            </h1>
            <p className="vpSub">
              Responda 5 perguntas sobre o que você vende e para quem. O 1loop monta sua estratégia de 30 dias e escreve os posts na sua voz. Você aprova; eles saem sozinhos no horário.
            </p>
            <a className="vpBtn" href={CTA} data-cta="hero">Ver meu primeiro post grátis →</a>
            <div className="vpMicro">
              <span>Sem cartão</span>
              <span>Pronto em 2 minutos</span>
              <span>Feito para o LinkedIn</span>
            </div>
          </div>

          <figure className="vpPost" style={{ margin: 0 }} aria-label="Exemplo de post gerado pelo 1loop">
            <div className="vpPostHead">
              <span className="vpAv" aria-hidden="true">VC</span>
              <span>
                <b>Você</b>
                <small>Executivo(a) de vendas · agora</small>
              </span>
            </div>
            <p><b>Perdi uma venda grande por causa de uma pergunta que eu não fiz.</b></p>
            <p>O cliente disse “vou pensar”. Eu aceitei e esperei.</p>
            <p>Hoje eu pergunto: “pensar sobre o quê, exatamente?”</p>
            <p>Quase sempre a resposta é preço, prazo ou alguém que não estava na reunião. Os três dá para resolver ali, na hora.</p>
            <p>Qual pergunta mudou o seu jeito de vender?</p>
            <span className="vpTag">Exemplo de post gerado pelo 1loop</span>
          </figure>
        </section>
      </div>

      <section className="vpSec">
        <div className="vpWrap">
          <h2 className="vpH2">Antes de responder sua mensagem, o cliente abre o seu perfil.</h2>
          <div className="vpGrid">
            <div className="vpCard"><b>Prospecção menos fria</b><p>Quem já viu seus posts responde mais fácil. Seu conteúdo trabalha antes da sua abordagem.</p></div>
            <div className="vpCard"><b>Lembrado na hora da compra</b><p>Postar com constância sobre o que você domina coloca seu nome na cabeça do cliente.</p></div>
            <div className="vpCard"><b>Sem tirar horas da meta</b><p>Você responde uma vez e aprova os posts em 5 minutos por semana. O resto o 1loop faz.</p></div>
          </div>
        </div>
      </section>

      <section className="vpSec">
        <div className="vpWrap">
          <h2 className="vpH2">Como funciona</h2>
          <div className="vpGrid">
            <div className="vpCard"><span className="vpNum">1</span><b>5 perguntas</b><p>O que você vende, para quem e o seu tom. Leva 2 minutos, dá para responder por voz.</p></div>
            <div className="vpCard"><span className="vpNum">2</span><b>Estratégia de 30 dias</b><p>Pilares, calendário e o objetivo de cada post: alcance, confiança ou venda.</p></div>
            <div className="vpCard"><span className="vpNum">3</span><b>Posts prontos, publicados sozinhos</b><p>Texto e imagem na sua voz. Você aprova e eles saem no LinkedIn no melhor horário.</p></div>
          </div>
        </div>
      </section>

      <section className="vpSec vpFaq">
        <div className="vpWrap">
          <h2 className="vpH2">Dúvidas comuns</h2>
          <details>
            <summary>Preciso colocar cartão para testar?</summary>
            <p>Não. Você cria a conta, responde as perguntas e vê sua estratégia e seu primeiro post sem cartão. Só se gostar você escolhe um plano e ganha 7 dias grátis com publicação automática.</p>
          </details>
          <details>
            <summary>Vai parecer escrito por robô?</summary>
            <p>Os posts nascem das suas respostas: o que você vende, para quem e o seu jeito de falar. Você revisa tudo antes, edita o que quiser e pode pedir ajustes.</p>
          </details>
          <details>
            <summary>Funciona para o meu segmento?</summary>
            <p>Funciona para quem vende B2B ou B2C, de SaaS a seguros, imóveis e consultoria. A estratégia é montada a partir do seu cliente e da sua oferta.</p>
          </details>
          <details>
            <summary>Quanto custa depois?</summary>
            <p>
              O Basic sai a partir de R$ {priceNow('basic')}/mês e o Pro, R$ {priceNow('pro')}/mês{founders ? ` no preço Founders, válido até ${FOUNDERS_ENDS_LABEL}` : ''}. Sem fidelidade, cancela em 1 clique.
            </p>
          </details>
        </div>
      </section>

      <section className="vpFinal">
        <div className="vpWrap">
          <h2 className="vpH2">Veja seu primeiro post antes de decidir.</h2>
          <a className="vpBtn" href={CTA} data-cta="final">Ver meu primeiro post grátis →</a>
          {founders && priceNow('pro') < pro.priceFull && (
            <div>
              <span className="vpFounders">Preço Founders ({`R$ ${priceNow('pro')}`} em vez de R$ {pro.priceFull} no Pro) {foundersCountdown()}</span>
            </div>
          )}
        </div>
      </section>

      <div className="vpSticky">
        <a className="vpBtn" href={CTA} data-cta="fixo">Ver meu primeiro post grátis →</a>
      </div>
      <LandingInteractions />
    </div>
  );
}
