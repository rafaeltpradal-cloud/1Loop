import type { Metadata } from 'next';
import { SalesLanding, type SalesCopy } from '../vendedores/SalesLanding';
import { salesPrices } from '../vendedores/prices';

// Página dos anúncios para executivos (região da Faria Lima): diretores, gerentes, heads e especialistas
// de várias áreas que querem um LinkedIn que gere audiência e autoridade, sem gastar horas escrevendo.
export const metadata: Metadata = {
  title: '1loop creators · Para executivos',
  description: 'Seu LinkedIn à altura da sua carreira. Posts na sua voz, toda semana, publicados no horário certo. 7 dias grátis, sem cartão.',
  alternates: { canonical: '/executivos' },
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

const COPY: SalesCopy = {
  eyebrow: 'Para executivos e líderes',
  h1: ['Sua carreira é sólida.', 'Seu LinkedIn está à altura?'],
  sub: 'Recrutadores, conselhos, clientes e o seu próprio time olham o seu perfil antes de qualquer conversa. Responda 5 perguntas sobre a sua trajetória e o 1loop escreve posts na sua voz toda semana e publica no horário certo. Você revisa em 5 minutos.',
  why: {
    title: 'Autoridade não se declara. Se constrói, post a post.',
    cards: [
      ['Audiência que trabalha por você', 'Quem acompanha suas ideias chega na reunião já confiando em você. Convites, oportunidades e parcerias começam no feed.'],
      ['Referência na sua área', 'Finanças, tecnologia, jurídico, produto, RH, operações: o que você aprende no dia a dia vira conteúdo que mostra como você pensa.'],
      ['Constância sem tomar sua agenda', 'Você responde uma vez. Todo mês recebe a estratégia e os posts prontos, com a sua voz. Aprova em 5 minutos por semana.'],
    ],
  },
  post: {
    role: 'Diretor · agora',
    lines: [
      'A decisão mais cara que tomei este ano foi uma que adiei.',
      'Esperei ter 100% dos dados para reestruturar a área. Quando tive, o mercado já tinha mudado.',
      'Hoje decido com 70% e corrijo rápido. O custo de errar pequeno é menor que o de chegar tarde.',
      'Para quem lidera: qual decisão você está esperando ficar “perfeita” para tomar?',
    ],
  },
  segment: 'Foi pensado para executivos e líderes de qualquer área: diretores, gerentes, heads, C-levels, sócios e especialistas que querem ser vistos pelo que sabem. A estratégia nasce da sua trajetória, do seu mercado e de onde você quer chegar.',
};

export default function ExecutivosPage() {
  return <SalesLanding copy={COPY} prices={salesPrices()} />;
}
