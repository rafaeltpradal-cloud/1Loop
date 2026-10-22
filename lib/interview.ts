export type QuestionKind = 'single' | 'multi' | 'text' | 'longtext';

export type Question = {
  id: string;
  block: string;
  title: string;
  hint: string;
  kind: QuestionKind;
  options?: string[];
  max?: number;
  placeholder?: string;
  optional?: boolean;
};

export type Answers = Record<string, string | string[]>;

export const QUESTIONS: Question[] = [
  {
    id: 'sobre', block: 'Você', kind: 'text',
    title: 'Como você se apresenta em uma frase?',
    hint: 'Do jeito que você falaria para alguém que acabou de conhecer.',
    placeholder: 'Ex.: Ajudo lojas de moda a vender mais pelo Instagram',
  },
  {
    id: 'oferta', block: 'Você', kind: 'longtext',
    title: 'O que você vende (ou quer começar a vender)?',
    hint: 'Produtos, serviços, mentorias, cursos. Se souber, inclua a faixa de preço.',
    placeholder: 'Ex.: Mentoria em grupo de 8 semanas (R$ 1.500) e consultoria individual',
  },
  {
    id: 'momento', block: 'Você', kind: 'single',
    title: 'Em que momento você está nas redes?',
    hint: 'Isso define por onde a estratégia começa.',
    options: ['Estou começando agora', 'Posto, mas sem constância', 'Posto com frequência, mas sem resultado', 'Já tenho resultado e quero escalar'],
  },
  {
    id: 'objetivo', block: 'Objetivo', kind: 'single',
    title: 'Qual é o principal objetivo para os próximos 30 dias?',
    hint: 'Um objetivo claro deixa cada conteúdo com um papel.',
    options: ['Vender meus produtos ou serviços', 'Gerar leads para o meu negócio', 'Virar referência no meu mercado', 'Crescer audiência'],
  },
  {
    id: 'publico', block: 'Público', kind: 'text',
    title: 'Quem é o seu cliente ideal?',
    hint: 'Quanto mais específico, melhor o conteúdo conversa com ele.',
    placeholder: 'Ex.: Donas de loja de roupa com 1 a 5 funcionárias, faturando até R$ 50 mil/mês',
  },
  {
    id: 'dores', block: 'Público', kind: 'longtext',
    title: 'Quais são as maiores dores ou desejos desse cliente?',
    hint: 'Liste 2 ou 3. É daqui que saem os conteúdos que mais engajam.',
    placeholder: 'Ex.: Posta todo dia e não vende; não sabe precificar; depende de promoção para girar estoque',
  },
  {
    id: 'temas', block: 'Conteúdo', kind: 'multi', max: 4,
    title: 'Sobre quais temas você domina e gosta de falar?',
    hint: 'Escolha até 4. Eles viram seus pilares de conteúdo.',
    options: ['Vendas', 'Marketing', 'Liderança', 'IA e tecnologia', 'Empreendedorismo', 'Carreira', 'Finanças', 'Saúde e bem-estar', 'Educação', 'Moda e beleza'],
  },
  {
    id: 'redes', block: 'Conteúdo', kind: 'multi', max: 3,
    title: 'Em quais redes você quer estar?',
    hint: 'Escolha até 3. Cada tema vira o formato certo para cada rede.',
    options: ['Instagram', 'LinkedIn', 'TikTok', 'YouTube Shorts', 'Facebook', 'Threads'],
  },
  {
    id: 'rosto', block: 'Conteúdo', kind: 'single',
    title: 'Você quer aparecer nos conteúdos?',
    hint: 'Com rosto, você envia fotos e vídeos e a gente cria os roteiros com você.',
    options: ['Sim, com rosto (fotos e vídeos)', 'Não, sem rosto', 'Às vezes'],
  },
  {
    id: 'tom', block: 'Voz', kind: 'single',
    title: 'Qual tom combina com você?',
    hint: 'Você pode ajustar depois de ver os primeiros conteúdos.',
    options: ['Provocativo e opinativo', 'Didático', 'Bastidores e histórias', 'Analítico, com dados', 'Leve e bem-humorado'],
  },
  {
    id: 'referencias', block: 'Voz', kind: 'text', optional: true,
    title: 'Quem você admira nas redes?',
    hint: 'Opcional. Ajuda a entender o estilo que você gosta.',
    placeholder: 'Nomes ou @perfis',
  },
  {
    id: 'limites', block: 'Voz', kind: 'text', optional: true,
    title: 'Tem algo que você nunca falaria ou faria nos conteúdos?',
    hint: 'Opcional. Assuntos, palavras ou formatos que não combinam com você.',
    placeholder: 'Ex.: Não falo de política; não faço dancinha',
  },
  {
    id: 'tempo', block: 'Rotina', kind: 'single',
    title: 'Quanto tempo por semana você quer dedicar?',
    hint: 'A gente adapta o fluxo ao seu tempo.',
    options: ['5 minutos (só aprovar)', '15 minutos (ajustar alguns)', 'Quero criar junto'],
  },
];

export function isAnswered(q: Question, value: string | string[] | undefined) {
  if (q.optional) return true;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' && value.trim().length > 1;
}

// Mantém só respostas de perguntas conhecidas, com tamanho limitado.
export function sanitizeAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  for (const q of QUESTIONS) {
    const v = obj[q.id];
    if (q.kind === 'multi' && Array.isArray(v)) {
      out[q.id] = v.filter((x): x is string => typeof x === 'string' && (q.options ?? []).includes(x)).slice(0, q.max ?? 10);
    } else if (q.kind === 'single' && typeof v === 'string' && (q.options ?? []).includes(v)) {
      out[q.id] = v;
    } else if ((q.kind === 'text' || q.kind === 'longtext') && typeof v === 'string') {
      out[q.id] = v.slice(0, q.kind === 'text' ? 300 : 1200);
    }
  }
  return out;
}
