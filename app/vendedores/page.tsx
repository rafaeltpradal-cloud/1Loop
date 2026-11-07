import type { Metadata } from 'next';
import { salesPrices } from './prices';
import { SalesLanding, type SalesCopy } from './SalesLanding';
import { visitorCardGroup } from '@/lib/trialGroupServer';

// Página dos anúncios (vendedores em geral).
export const metadata: Metadata = {
  title: '1loop creators · Autoridade no LinkedIn para quem vende',
  description: 'Responda 5 perguntas e receba sua estratégia de 30 dias e posts prontos na sua voz. Grátis e sem cartão.',
  alternates: { canonical: '/vendedores' },
};

export const dynamic = 'force-dynamic';

const COPY: SalesCopy = {
  eyebrow: 'Para quem vive de vender',
  h1: ['Você sabe vender.', 'Falta o LinkedIn saber disso.'],
  sub: 'Responda 5 perguntas sobre o que você vende e para quem. O 1loop monta sua estratégia de 30 dias e escreve os posts na sua voz. Você aprova; eles saem sozinhos no horário.',
  why: {
    title: 'Antes de responder sua mensagem, o cliente abre o seu perfil.',
    cards: [
      ['Prospecção menos fria', 'Quem já viu seus posts responde mais fácil. Seu conteúdo trabalha antes da sua abordagem.'],
      ['Lembrado na hora da compra', 'Postar com constância sobre o que você domina coloca seu nome na cabeça do cliente.'],
      ['Sem tirar horas da meta', 'Você responde uma vez e aprova os posts em 5 minutos por semana. O resto o 1loop faz.'],
    ],
  },
  post: {
    role: 'Executivo(a) de vendas · agora',
    lines: [
      'Perdi uma venda grande por causa de uma pergunta que eu não fiz.',
      'O cliente disse “vou pensar”. Eu aceitei e esperei.',
      'Hoje eu pergunto: “pensar sobre o quê, exatamente?”',
      'Quase sempre a resposta é preço, prazo ou alguém que não estava na reunião. Os três dá para resolver ali, na hora.',
      'Qual pergunta mudou o seu jeito de vender?',
    ],
  },
  segment: 'Funciona para quem vende B2B ou B2C, de SaaS a seguros, imóveis e consultoria. A estratégia é montada a partir do seu cliente e da sua oferta.',
};


export default async function SalesLandingPage() {
  return <SalesLanding copy={COPY} prices={salesPrices()} cardTrial={await visitorCardGroup()} />;
}
