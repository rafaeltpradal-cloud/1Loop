import Anthropic from '@anthropic-ai/sdk';
import { createJson } from '@/lib/aiJson';
import { QUESTIONS, resolveAnswers, type Answers } from '@/lib/interview';
import { PLANS, type PlanId } from '@/lib/plans';

export type Pillar = { nome: string; percentual: number; descricao: string };
export type FunnelStage = { etapa: string; papel: string; formatos: string[] };
// "data" (AAAA-MM-DD) só existe quando a pessoa muda o post de dia no calendário.
export type CalendarItem = { dia: number; pilar: number; formato: string; rede: string; comRosto: boolean; tema: string; objetivo: string; data?: string };
export type WeekPlan = { semana: number; foco: string; acoes: string[] };
export type Indicator = { nome: string; porque: string };

export type Strategy = {
  /** Pedidos de ajuste feitos à IA nesta estratégia e a versão anterior (para desfazer). Só o servidor grava. */
  ajustes?: number;
  anterior?: Strategy;
  resumo: string;
  objetivo: string;
  posicionamento: string;
  serie: { nome: string; descricao: string };
  ritmo: { frequencia: string; horario: string; redes: string[] };
  pilares: Pillar[];
  funil: FunnelStage[];
  calendario: CalendarItem[];
  planoAcao: WeekPlan[];
  indicadores: Indicator[];
};

export const PILLAR_COLORS = ['#3B6CF6', '#7C4DFF', '#E0458F', '#F08A24', '#12A594'];

export function postingDays(plan: PlanId): number[] {
  const step = PLANS[plan].everyNDays;
  const days: number[] = [];
  for (let d = 1; d <= 30; d += step) days.push(d);
  return days;
}

// ---------------------------------------------------------------------------
// Geração com Claude
// ---------------------------------------------------------------------------

const SYSTEM = `Você é estrategista-chefe de conteúdo da 1loop creators, uma ferramenta brasileira que cria estratégias de conteúdo para quem vende pelas redes sociais (ou quer começar).
Seu trabalho: transformar a entrevista de um cliente em uma estratégia de 30 dias clara, prática e visual, em que cada conteúdo tem um objetivo.
Princípios:
- Conteúdo com estratégia, redes com resultado. Nada de post solto.
- Fale como o cliente fala; respeite o tom e os limites que ele informou.
- Equilibre valor e oferta. A oferta entra no momento certo da jornada, nunca como spam.
- Se o cliente está começando, priorize posicionamento e constância; se já tem resultado, priorize conversão e escala.
- Adapte formatos à rede (ex.: Reels/TikTok para alcance, carrossel para salvamento, LinkedIn para autoridade) e à escolha de aparecer ou não.
- Escreva em português do Brasil, frases curtas e concretas. Não invente números de resultado.
Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois.`;

function schemaFor(plan: PlanId) {
  const days = postingDays(plan);
  return `Formato exato do JSON:
{
  "resumo": "2 frases sobre a estratégia do mês",
  "objetivo": "objetivo do mês em uma frase",
  "posicionamento": "como o cliente quer ser lembrado, em uma frase",
  "serie": { "nome": "nome curto de uma série recorrente com identidade", "descricao": "1 frase" },
  "ritmo": { "frequencia": "${PLANS[plan].rhythm}", "horario": "melhor horário sugerido, ex.: 07:30", "redes": ["redes escolhidas"] },
  "pilares": [ { "nome": "nome do pilar", "percentual": 40, "descricao": "1 frase" } ],
  "funil": [ { "etapa": "Alcance|Conexão|Confiança|Venda", "papel": "o que os conteúdos dessa etapa fazem", "formatos": ["formatos"] } ],
  "calendario": [ { "dia": 1, "pilar": 0, "formato": "Reels|Carrossel|Imagem de série|Texto|Stories|Thread|Artigo|Prova social", "rede": "uma das redes escolhidas", "comRosto": true, "tema": "tema específico do conteúdo, como um título", "objetivo": "alcance|conexão|confiança|venda" } ],
  "planoAcao": [ { "semana": 1, "foco": "foco da semana", "acoes": ["3 ações práticas"] } ],
  "indicadores": [ { "nome": "indicador", "porque": "por que acompanhar" } ]
}
Regras:
- "pilares": 3 a 5 itens; os percentuais somam 100; o último pilar é a oferta (venda) com 10% a 25%.
- "funil": exatamente 4 etapas, na ordem Alcance, Conexão, Confiança, Venda.
- "calendario": exatamente ${days.length} itens, um para cada um destes dias: ${days.join(', ')}. "pilar" é o índice (0..n-1) do pilar.
- Respeite a escolha de rosto: se o cliente não quer aparecer, "comRosto" é sempre false.
- "planoAcao": exatamente 4 semanas.
- "indicadores": 4 itens ligados ao objetivo.`;
}

function interviewText(answers: Answers) {
  return QUESTIONS.map((q) => {
    const v = answers[q.id];
    const txt = Array.isArray(v) ? v.join(', ') : v;
    return `- ${q.title}\n  ${txt && String(txt).trim() ? txt : '(não respondido)'}`;
  }).join('\n');
}

export async function generateStrategy(rawAnswers: Answers, plan: PlanId): Promise<{ strategy: Strategy; source: 'ai' | 'demo' }> {
  // "Outro" vira o texto que a pessoa escreveu.
  const answers = resolveAnswers(rawAnswers);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return { strategy: demoStrategy(answers, plan), source: 'demo' };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const parsed = await createJson(client, {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 8000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Plano contratado: ${PLANS[plan].name} (${PLANS[plan].rhythm}).\n\nEntrevista do cliente:\n${interviewText(answers)}\n\n${schemaFor(plan)}`,
      },
    ],
  });

  return { strategy: normalizeStrategy(parsed, answers, plan), source: 'ai' };
}

const NETWORK_NAMES = ['Instagram', 'LinkedIn', 'TikTok', 'YouTube Shorts', 'Facebook', 'Threads'];

/** Ajusta a estratégia atual conforme o pedido da pessoa, mantendo o que não foi pedido para mudar. */
export async function reviseStrategy(
  current: Strategy,
  rawAnswers: Answers,
  plan: PlanId,
  pedido: string,
): Promise<{ strategy: Strategy; resposta: string }> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('IA indisponível');
  const answers = resolveAnswers(rawAnswers);
  const atual: Partial<Strategy> = { ...current };
  delete atual.ajustes;
  delete atual.anterior;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const parsed = await createJson(client, {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 8000,
    system: `${SYSTEM.replace('Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois.', '')}
Agora você está AJUSTANDO uma estratégia que já existe, a pedido do cliente. Mude só o que o pedido exige e mantenha todo o resto igual, inclusive os dias do calendário que não precisam mudar. Se o pedido incluir uma rede nova, ela pode entrar em "ritmo.redes" e no calendário. Não invente números de resultado.
Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois.`,
    messages: [
      {
        role: 'user',
        content: `Plano contratado: ${PLANS[plan].name} (${PLANS[plan].rhythm}).

Entrevista do cliente:
${interviewText(answers)}

Estratégia atual (JSON):
${JSON.stringify(atual)}

Pedido do cliente:
"""${pedido}"""

${schemaFor(plan)}

Devolva a estratégia COMPLETA já ajustada, nesse formato, e mais o campo "resposta": até 2 frases curtas, em segunda pessoa, dizendo o que mudou.`,
      },
    ],
  });
  const raw = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  // Redes: as que o ajuste devolveu (só nomes conhecidos); se não vier nenhuma, as de antes.
  const ritmo = (raw.ritmo && typeof raw.ritmo === 'object' ? raw.ritmo : {}) as Record<string, unknown>;
  const novas = arr<unknown>(ritmo.redes).filter((r): r is string => typeof r === 'string' && NETWORK_NAMES.includes(r));
  const redes = novas.length ? Array.from(new Set(novas)) : current.ritmo.redes;
  const strategy = normalizeStrategy(raw, { ...answers, redes }, plan);
  // Mudanças de dia feitas à mão continuam valendo nos posts que não mudaram.
  strategy.calendario = strategy.calendario.map((c) => {
    const old = current.calendario.find((o) => o.dia === c.dia);
    return old?.data && old.tema === c.tema ? { ...c, data: old.data } : c;
  });
  const resposta = typeof raw.resposta === 'string' && raw.resposta.trim() ? raw.resposta.trim().slice(0, 400) : 'Pronto, ajustei a estratégia.';
  return { strategy, resposta };
}

// ---------------------------------------------------------------------------
// Normalização: garante que o painel sempre recebe dados consistentes
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = '') => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeStrategy(raw: unknown, answers: Answers, plan: PlanId): Strategy {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const demo = demoStrategy(answers, plan);
  const redes = chosenNetworks(answers);
  const noFace = answers.rosto === 'Não, sem rosto';

  let pilares = arr<Record<string, unknown>>(r.pilares)
    .map((p) => ({ nome: str(p.nome), percentual: Math.max(0, Number(p.percentual) || 0), descricao: str(p.descricao) }))
    .filter((p) => p.nome)
    .slice(0, 5);
  if (pilares.length < 3) pilares = demo.pilares;
  const total = pilares.reduce((s, p) => s + p.percentual, 0) || 1;
  pilares = pilares.map((p) => ({ ...p, percentual: Math.round((p.percentual / total) * 100) }));
  pilares[pilares.length - 1].percentual += 100 - pilares.reduce((s, p) => s + p.percentual, 0);

  const days = postingDays(plan);
  const byDay = new Map<number, Record<string, unknown>>();
  for (const c of arr<Record<string, unknown>>(r.calendario)) byDay.set(Number(c.dia), c);
  const calendario: CalendarItem[] = days.map((dia, i) => {
    const c = byDay.get(dia) ?? {};
    const d = demo.calendario[i];
    const pilar = Number.isInteger(c.pilar) && (c.pilar as number) >= 0 && (c.pilar as number) < pilares.length ? (c.pilar as number) : d.pilar % pilares.length;
    const rede = redes.includes(str(c.rede)) ? str(c.rede) : d.rede;
    return {
      dia,
      pilar,
      formato: str(c.formato, d.formato),
      rede,
      comRosto: noFace ? false : typeof c.comRosto === 'boolean' ? c.comRosto : d.comRosto,
      tema: str(c.tema, d.tema),
      objetivo: str(c.objetivo, d.objetivo),
    };
  });

  const funil = arr<Record<string, unknown>>(r.funil)
    .map((f) => ({ etapa: str(f.etapa), papel: str(f.papel), formatos: arr<string>(f.formatos).filter((x) => typeof x === 'string').slice(0, 4) }))
    .filter((f) => f.etapa)
    .slice(0, 4);

  const planoAcao = arr<Record<string, unknown>>(r.planoAcao)
    .map((w, i) => ({ semana: i + 1, foco: str(w.foco), acoes: arr<string>(w.acoes).filter((x) => typeof x === 'string').slice(0, 4) }))
    .filter((w) => w.foco)
    .slice(0, 4);

  const indicadores = arr<Record<string, unknown>>(r.indicadores)
    .map((x) => ({ nome: str(x.nome), porque: str(x.porque) }))
    .filter((x) => x.nome)
    .slice(0, 4);

  const serie = (r.serie && typeof r.serie === 'object' ? r.serie : {}) as Record<string, unknown>;
  const ritmo = (r.ritmo && typeof r.ritmo === 'object' ? r.ritmo : {}) as Record<string, unknown>;

  return {
    resumo: str(r.resumo, demo.resumo),
    objetivo: str(r.objetivo, demo.objetivo),
    posicionamento: str(r.posicionamento, demo.posicionamento),
    serie: { nome: str(serie.nome, demo.serie.nome), descricao: str(serie.descricao, demo.serie.descricao) },
    ritmo: { frequencia: PLANS[plan].rhythm, horario: str(ritmo.horario, demo.ritmo.horario), redes },
    pilares,
    funil: funil.length === 4 ? funil : demo.funil,
    calendario,
    planoAcao: planoAcao.length === 4 ? planoAcao : demo.planoAcao,
    indicadores: indicadores.length >= 3 ? indicadores : demo.indicadores,
  };
}

function chosenNetworks(answers: Answers) {
  const r = answers.redes;
  return Array.isArray(r) && r.length ? r : ['Instagram'];
}

// ---------------------------------------------------------------------------
// Modo demonstração (sem chave de API): estratégia montada por regras
// ---------------------------------------------------------------------------

export function demoStrategy(answers: Answers, plan: PlanId): Strategy {
  const redes = chosenNetworks(answers);
  const temas = Array.isArray(answers.temas) && answers.temas.length ? answers.temas.slice(0, 3) : ['Seu mercado', 'Bastidores', 'Método'];
  const objetivo = typeof answers.objetivo === 'string' ? answers.objetivo : 'Vender meus produtos ou serviços';
  const rosto = answers.rosto;
  const tom = typeof answers.tom === 'string' ? answers.tom : 'Didático';
  const oferta = typeof answers.oferta === 'string' && answers.oferta.trim() ? answers.oferta.trim().split(/[.\n]/)[0] : 'sua oferta';
  const publico = typeof answers.publico === 'string' && answers.publico.trim() ? answers.publico.trim() : 'seu cliente ideal';

  const share = temas.length === 3 ? [35, 25, 25] : temas.length === 2 ? [45, 40] : [85];
  const pilares: Pillar[] = [
    ...temas.map((t, i) => ({ nome: t, percentual: share[i], descricao: `Conteúdos de ${t.toLowerCase()} para ${publico}.` })),
    { nome: 'Oferta', percentual: 15, descricao: `Convite claro e no momento certo para ${oferta}.` },
  ];

  const serieNome = tom.startsWith('Provocativo') ? 'Opinião impopular' : tom.startsWith('Bastidores') ? 'Diário de bastidor' : tom.startsWith('Analítico') ? 'Número da semana' : 'Playbook';
  const formatos = ['Reels', 'Carrossel', 'Imagem de série', 'Stories', 'Texto', 'Prova social'];
  const objetivos = ['alcance', 'conexão', 'confiança', 'venda'];
  const days = postingDays(plan);

  const calendario: CalendarItem[] = days.map((dia, i) => {
    const isOffer = (i + 1) % 6 === 0;
    const pilar = isOffer ? pilares.length - 1 : i % (pilares.length - 1);
    const formato = isOffer ? 'Prova social' : formatos[i % 5];
    const comRosto = rosto === 'Não, sem rosto' ? false : rosto === 'Às vezes' ? formato === 'Reels' : formato === 'Reels' || formato === 'Stories';
    return {
      dia,
      pilar,
      formato,
      rede: redes[i % redes.length],
      comRosto,
      tema: isOffer ? `Resultado de cliente com ${oferta}` : `${serieNome} #${String(i + 1).padStart(2, '0')} · ${pilares[pilar].nome}`,
      objetivo: isOffer ? 'venda' : objetivos[i % 3],
    };
  });

  return {
    resumo: `Um mês para posicionar você como referência para ${publico} e levar essa audiência até ${oferta}. Constância primeiro, oferta no momento certo.`,
    objetivo,
    posicionamento: typeof answers.sobre === 'string' && answers.sobre.trim() ? answers.sobre.trim() : 'Quem resolve o problema do seu cliente com clareza.',
    serie: { nome: serieNome, descricao: `Série recorrente no tom "${tom.toLowerCase()}" para o público reconhecer você no feed.` },
    ritmo: { frequencia: PLANS[plan].rhythm, horario: '07:30', redes },
    pilares,
    funil: [
      { etapa: 'Alcance', papel: 'Fazer pessoas novas conhecerem você.', formatos: ['Reels', 'Imagem de série'] },
      { etapa: 'Conexão', papel: 'Mostrar quem está por trás e criar identificação.', formatos: ['Stories', 'Texto'] },
      { etapa: 'Confiança', papel: 'Provar que seu método funciona.', formatos: ['Carrossel', 'Prova social'] },
      { etapa: 'Venda', papel: 'Fazer a oferta para quem já está pronto.', formatos: ['Prova social', 'Stories'] },
    ],
    calendario,
    planoAcao: [
      { semana: 1, foco: 'Lançar a série e o seu ponto de vista', acoes: ['Atualizar bio e destaques com o posicionamento', `Publicar o primeiro "${serieNome}"`, 'Comentar em 15 perfis do seu nicho'] },
      { semana: 2, foco: 'Aprofundar as dores do seu cliente', acoes: ['Responder dúvidas reais em conteúdo', 'Primeiro carrossel com o seu método', 'Enquete nos stories sobre a maior dor'] },
      { semana: 3, foco: 'Prova: casos, método e bastidores', acoes: ['Publicar um resultado de cliente', 'Mostrar o processo por trás do serviço', 'Caixinha de perguntas'] },
      { semana: 4, foco: 'Oferta: transformar audiência em vendas', acoes: [`Apresentar ${oferta} com clareza`, 'Reforçar com prova social', 'Revisar o que deu resultado e ajustar o mês 2'] },
    ],
    indicadores: [
      { nome: 'Alcance', porque: 'Mostra se novas pessoas estão chegando.' },
      { nome: 'Salvamentos e compartilhamentos', porque: 'Indicam conteúdo que gera valor de verdade.' },
      { nome: 'Novos seguidores', porque: 'Mostra se o alcance vira audiência.' },
      { nome: 'Leads e vendas', porque: 'O resultado que importa no fim do mês.' },
    ],
  };
}
