import type { Metadata } from 'next';
import { SalesLanding, type SalesCopy } from '../vendedores/SalesLanding';
import { salesPrices } from '../vendedores/prices';
import { EUR_PRICES } from '@/lib/market';

// Página dos anúncios de Lisboa (Portugal): executivos e líderes de qualquer área, em português de Portugal.
// Quem se cadastra aqui vira conta de Portugal: preço em euro e 1 post de teste (sem os 7 dias do Brasil).
export const metadata: Metadata = {
  title: '1loop creators · Lisboa',
  description: 'O seu LinkedIn à altura da sua carreira. Posts na sua voz, todas as semanas, publicados no horário certo. Post de teste grátis, sem cartão.',
  alternates: { canonical: '/lisboa' },
  robots: { index: false, follow: true },
  other: { 'content-language': 'pt-PT' },
};

export const dynamic = 'force-dynamic';

const COPY: SalesCopy = {
  eyebrow: 'Para executivos e líderes em Lisboa',
  h1: ['A sua carreira é sólida.', 'O seu LinkedIn está à altura?'],
  sub: 'Recrutadores, administrações, clientes e a sua própria equipa olham para o seu perfil antes de qualquer conversa. Responda a 5 perguntas sobre o seu percurso e o 1loop escreve posts na sua voz todas as semanas e publica-os no horário certo. Revê tudo em 5 minutos.',
  why: {
    title: 'Autoridade não se declara. Constrói-se, post a post.',
    cards: [
      ['Audiência que trabalha por si', 'Quem acompanha as suas ideias chega à reunião já a confiar em si. Convites, oportunidades e parcerias começam no feed.'],
      ['Referência na sua área', 'Finanças, tecnologia, jurídico, produto, recursos humanos, operações: o que aprende no dia a dia vira conteúdo que mostra como pensa.'],
      ['Constância sem ocupar a agenda', 'Responde uma vez. Todos os meses recebe a estratégia e os posts prontos, na sua voz. Aprova em 5 minutos por semana.'],
    ],
  },
  post: {
    role: 'Diretora · agora',
    lines: [
      'A decisão mais cara que tomei este ano foi uma que adiei.',
      'Esperei ter 100% dos dados para reestruturar a equipa. Quando os tive, o mercado já tinha mudado.',
      'Hoje decido com 70% e corrijo depressa. Errar pouco custa menos do que chegar tarde.',
      'Para quem lidera: que decisão está à espera de ficar “perfeita” para tomar?',
    ],
  },
  segment: 'Foi pensado para executivos e líderes de qualquer área: diretores, gestores, heads, C-levels, sócios e especialistas que querem ser reconhecidos pelo que sabem. A estratégia nasce do seu percurso, do seu mercado e de onde quer chegar.',
};

export default function LisboaPage() {
  return <SalesLanding copy={COPY} prices={salesPrices()} pt={{ basic: EUR_PRICES.basic, pro: EUR_PRICES.pro }} />;
}
