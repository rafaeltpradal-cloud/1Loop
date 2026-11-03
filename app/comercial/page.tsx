import type { Metadata } from 'next';
import { SalesLanding, type SalesCopy } from '../vendedores/SalesLanding';
import { salesPrices } from '../vendedores/prices';

// Página dos anúncios para o time comercial: SDRs (pré-vendas) e executivos de conta (AEs).
// O ângulo é carreira: autonomia, destaque dentro da empresa e constância no LinkedIn.
export const metadata: Metadata = {
  title: '1loop creators · Para SDRs e executivos de conta',
  description: 'Vire referência na área comercial com posts na sua voz, toda semana. Responda 5 perguntas e veja seu primeiro post grátis, sem cartão.',
  alternates: { canonical: '/comercial' },
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

const COPY: SalesCopy = {
  eyebrow: 'Para SDRs e executivos de conta',
  h1: ['Você bate meta.', 'Seu LinkedIn precisa mostrar isso.'],
  sub: 'Pré-vendas ou fechamento: quem aparece com constância vira referência para o cliente, para o gestor e para a próxima oportunidade. Responda 5 perguntas e o 1loop escreve posts na sua voz toda semana. Você revisa em 5 minutos.',
  why: {
    title: 'Quem é visto é lembrado. Dentro e fora da empresa.',
    cards: [
      ['Prospecção mais quente', 'O lead que já viu seus posts atende a ligação e responde a mensagem. Seu conteúdo abre a porta antes do primeiro contato.'],
      ['Destaque no time', 'Quem compartilha o que aprende na rua vira referência para o gestor, para o time e para quem está chegando.'],
      ['Constância com autonomia', 'Sua marca, no seu ritmo, sem depender do marketing. Você responde uma vez e aprova os posts em 5 minutos por semana.'],
    ],
  },
  post: {
    role: 'SDR · agora',
    lines: [
      'Parei de abrir a ligação falando da minha empresa.',
      'Agora eu abro com o momento do cliente: “vi que vocês estão contratando para o time comercial. Como está a rampa de quem chegou?”',
      'A conversa deixa de ser sobre o que eu vendo e passa a ser sobre o que ele precisa resolver.',
      'Quem trabalha com pré-vendas: qual abertura funciona melhor para você?',
    ],
  },
  segment: 'Foi pensado para quem está no dia a dia da venda: SDRs, BDRs, executivos de conta, closers e líderes comerciais. A estratégia nasce da sua rotina, do seu cliente e do que você quer ser conhecido por saber.',
};

export default function ComercialPage() {
  return <SalesLanding copy={COPY} prices={salesPrices()} />;
}
