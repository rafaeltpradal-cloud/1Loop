import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LANDING_CSS, LANDING_HTML } from '../_landing/content';
import { LandingInteractions } from '../_landing/LandingInteractions';

// Página da campanha para vendedores e profissionais comerciais (anúncios da Meta).
// Usa a mesma landing da home, trocando a promessa do topo e somando uma seção sobre por que vendedor precisa do LinkedIn.

export const metadata: Metadata = {
  title: '1loop creators · Para quem vende: autoridade no LinkedIn sem perder horas escrevendo',
  description:
    'Você sabe vender. Falta o LinkedIn saber disso. Uma entrevista rápida, uma estratégia de 30 dias e posts prontos no seu estilo, publicados sozinhos. Teste 7 dias.',
  alternates: { canonical: '/vendedores' },
};

const card = (eyebrow: string, title: string, text: string) =>
  `<div class="card lift" style="padding: var(--lpC, 28px); display: flex; flex-direction: column; gap: 12px"><div class="eyebrow">${eyebrow}</div><div style="font-size: 22px; font-weight: 700; letter-spacing: -0.4px">${title}</div><p style="margin: 0; font-size: 15px; line-height: 1.6; color: #5E646C">${text}</p></div>`;

const WHY_SALES = `
<section aria-label="Por que quem vende precisa do LinkedIn" style="max-width: 1240px; margin: 0 auto; padding: 0 var(--lpX, 24px) calc(96px * var(--lpS, 1)); display: flex; flex-direction: column; gap: 32px">
<div style="display: flex; flex-direction: column; gap: 14px; max-width: 760px">
<div class="eyebrow">Para quem vive de vender</div>
<h2 style="margin: 0; font-size: clamp(30px, 3.6vw, 44px); line-height: 1.1; font-weight: 700; letter-spacing: -1.2px"><span class="graphite">Antes de responder sua mensagem,</span> <span class="grad">o cliente abre o seu perfil.</span></h2>
<p style="margin: 0; font-size: 17px; line-height: 1.65; color: #5E646C">Se ele encontra um perfil parado, você é só mais um vendedor. Se encontra opinião, método e resultado, a conversa já começa com confiança.</p>
</div>
<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px">
${card('Prospecção', 'Menos frio no primeiro contato.', 'Quem já viu seus posts responde mais fácil. Seu conteúdo trabalha antes da sua abordagem.')}
${card('Autoridade', 'Seu nome lembrado na hora da compra.', 'Postar com constância sobre o que você domina coloca você na cabeça do cliente quando a necessidade aparece.')}
${card('Tempo', 'Sem tirar horas da sua meta.', 'Você responde uma entrevista uma vez e aprova o lote em 5 minutos por semana. O resto o 1loop faz.')}
</div>
</section>
`;

function salesHtml(base: string) {
  return base
    .replace(
      'Para quem quer autoridade no LinkedIn<span class="late">, <span class="grad">e vender com ela.</span></span>',
      'Para vendedores e profissionais comerciais<span class="late">, <span class="grad">que querem autoridade.</span></span>',
    )
    .replace(
      '<span class="graphite">Conteúdo com estratégia.</span> <span class="grad">LinkedIn com resultado.</span>',
      '<span class="graphite">Você sabe vender.</span> <span class="grad">Falta o LinkedIn saber disso.</span>',
    )
    .replace(
      'Uma entrevista sobre você, uma estratégia real e posts prontos para o seu LinkedIn, cada um com um objetivo claro. Você aprova, a gente publica no horário e você acompanha o resultado.',
      'Responda uma entrevista rápida sobre o que você vende e para quem. O 1loop monta sua estratégia de 30 dias e entrega os posts prontos, no seu estilo. Você aprova pelo celular e eles saem sozinhos, no horário.',
    )
    .replace('<!-- O PROBLEMA -->', `${WHY_SALES}\n<!-- O PROBLEMA -->`)
    .replace(
      'Daqui a 30 dias, você vai ter <span class="grad">um mês inteiro de conteúdo</span> publicado.',
      'Daqui a 30 dias, seu cliente vai ter <span class="grad">um mês de motivos</span> para confiar em você.',
    );
}

export default async function SalesLandingPage() {
  let html = salesHtml(LANDING_HTML);
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      html = html
        .replace('href="/entrar" data-auth-link>Entrar</a>', 'href="/app" data-auth-link>Minha conta</a>')
        .replace('href="/entrar" style="color: #5E646C; text-decoration: none" data-auth-link>Entrar</a>', 'href="/app" style="color: #5E646C; text-decoration: none" data-auth-link>Minha conta</a>')
        .replace('class="btn3d btnSm" href="#planos"', 'class="btn3d btnSm lpHideWhenIn" href="#planos"');
    }
  } catch {
    // Sem sessão: mantém "Entrar".
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <LandingInteractions />
    </>
  );
}
