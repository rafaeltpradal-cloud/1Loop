import Anthropic from '@anthropic-ai/sdk';
import { QUESTIONS, type Answers } from '@/lib/interview';
import type { CalendarItem, Strategy } from '@/lib/strategy';
import { formatLong, specialDatesByDay, fromISO } from '@/lib/dates';
import { kindOf, type FormatKind, type PostContent, type Story } from '@/lib/contentTypes';
import { sanitizeScene, type Scene } from '@/lib/scene';

export * from '@/lib/contentTypes';

// ---------------------------------------------------------------------------
// Regras por rede e por formato
// ---------------------------------------------------------------------------

const NETWORK_RULES: Record<string, string> = {
  Instagram: 'Legenda de até 1.500 caracteres, primeira linha forte (aparece antes do "mais"), parágrafos curtos, 3 a 5 hashtags específicas.',
  LinkedIn: 'Texto de 900 a 1.600 caracteres, primeira linha que para a rolagem, frases curtas com quebras de linha, tom profissional e direto. No máximo 3 hashtags. Sem emojis em excesso.',
  TikTok: 'Legenda curta (até 150 caracteres) com 3 ou 4 hashtags. O peso está no roteiro.',
  'YouTube Shorts': 'Título de até 80 caracteres na primeira linha e descrição curta. 2 ou 3 hashtags.',
  Facebook: 'Texto de 400 a 900 caracteres, conversacional, termina com uma pergunta. 0 a 2 hashtags.',
  Threads: 'Texto de até 450 caracteres, opinião direta, sem hashtags ou no máximo 1.',
};

const FORMAT_RULES: Record<FormatKind, string> = {
  carrossel: '"slides": 5 a 7 slides. O 1º é a capa com o gancho (título curto, até 8 palavras, e texto de apoio curto). Do 2º ao penúltimo, 1 ideia por slide (título até 8 palavras, texto até 30 palavras). O último é a chamada (salvar, compartilhar, comentar ou a oferta). A "legenda" complementa o carrossel sem repetir tudo.',
  imagem: '"imagem": uma frase de impacto de até 22 palavras em "frase" e, em "destaque", o trecho exato da frase (até 6 palavras) que deve ser marcado. A "legenda" desenvolve a ideia da imagem.',
  video: '"roteiro": vídeo vertical de 30 a 45 segundos. "capa": texto da capa (até 6 palavras). "cenas": 4 a 6 cenas; a 1ª é o gancho dos 3 primeiros segundos. Em cada cena, "fala" é o que a pessoa diz (ou o texto na tela, se for sem rosto) e "visual" é o que aparece. A última cena é a chamada. "duracao" como "35s".',
  stories: '"stories": sequência de 4 ou 5 stories. Tipos: "texto", "enquete" (com 2 "opcoes"), "caixinha" (pergunta aberta) e "link" (chamada para a oferta). Texto de cada story até 25 palavras. A "legenda" pode ser uma linha curta.',
  thread: '"partes": 5 a 7 posts encadeados, cada um com até 280 caracteres; o 1º é o gancho e o último a chamada. A "legenda" é igual ao 1º post.',
  texto: 'Só texto: a "legenda" é o post completo, com gancho na primeira linha, desenvolvimento em parágrafos curtos e fechamento com chamada.',
  prova: 'Prova social SEM inventar depoimentos, números ou clientes. "imagem.frase" deve ser um modelo como "[Cole aqui o depoimento do seu cliente]" ou uma frase do próprio cliente da pessoa só se ela tiver informado. A "legenda" conta o contexto (problema, o que foi feito, resultado) com marcadores [entre colchetes] para a pessoa completar.',
};

// ---------------------------------------------------------------------------
// Geração com Claude
// ---------------------------------------------------------------------------

const SYSTEM = `Você é redator-chefe da 1loop creators. Escreve conteúdos prontos para publicar em redes sociais, em português do Brasil, para quem vende pelas redes.
Princípios:
- Cada conteúdo tem um objetivo (alcance, conexão, confiança ou venda) e segue a estratégia do cliente.
- Escreva na voz do cliente, em primeira pessoa, respeitando o tom e os limites que ele informou.
- Gancho forte na primeira linha. Frases curtas. Nada de clichê de coach, nada de "neste post vou falar".
- Não invente números, resultados, clientes, depoimentos ou fatos sobre o cliente. Quando precisar de um dado que você não tem, use [marcador entre colchetes] para ele completar.
- Venda sem empurrar: a oferta aparece quando o objetivo é venda; nos outros, a chamada é para salvar, comentar, compartilhar ou seguir.
Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois.`;

function interviewText(answers: Answers) {
  return QUESTIONS.map((q) => {
    const v = answers[q.id];
    const txt = Array.isArray(v) ? v.join(', ') : v;
    return txt && String(txt).trim() ? `- ${q.title}\n  ${txt}` : '';
  })
    .filter(Boolean)
    .join('\n');
}

export type InputImage = { data: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' };

export type GenerateInput = {
  strategy: Strategy;
  item: CalendarItem;
  date: string; // AAAA-MM-DD
  answers: Answers;
  serieNumero?: number;
  foto?: InputImage; // foto escolhida para o post
  referencias?: InputImage[]; // imagens de referência de estilo
};

function promptFor(input: GenerateInput) {
  const { strategy, item, date, answers, serieNumero } = input;
  const kind = kindOf(item.formato);
  const pilar = strategy.pilares[item.pilar] ?? strategy.pilares[0];
  const etapa = strategy.funil.find((f) => f.etapa.toLowerCase().startsWith(item.objetivo.slice(0, 4).toLowerCase()));
  const special = specialDatesByDay([fromISO(date).getFullYear()]).get(date);
  const rede = NETWORK_RULES[item.rede] ? item.rede : 'Instagram';

  return `Entrevista do cliente:
${interviewText(answers)}

Estratégia:
- Objetivo do mês: ${strategy.objetivo}
- Posicionamento: ${strategy.posicionamento}
- Série recorrente: ${strategy.serie.nome} — ${strategy.serie.descricao}${serieNumero ? ` (este é o nº ${String(serieNumero).padStart(3, '0')} da série)` : ''}
- Pilar deste conteúdo: ${pilar.nome} — ${pilar.descricao}
- Etapa da jornada: ${item.objetivo}${etapa ? ` — ${etapa.papel}` : ''}

Conteúdo a escrever:
- Data: ${formatLong(date)}${special ? ` (${special.map((s) => s.nome).join(', ')}; use a data só se fizer sentido para o tema)` : ''}
- Rede: ${rede}
- Formato: ${item.formato}
- ${item.comRosto ? 'Com rosto: a pessoa aparece e fala para a câmera.' : 'Sem rosto: nada de a pessoa aparecer; use texto na tela, imagens ou narração.'}
- Tema: ${item.tema}

${input.foto ? 'Foto do post: a PRIMEIRA imagem anexada vai publicada junto com este conteúdo. Escreva em cima dela: aproveite o que aparece (cenário, momento, expressão), sem inventar fatos que a foto não mostra.\n' : ''}${input.referencias?.length ? `Referências: ${input.foto ? 'as outras imagens anexadas' : 'as imagens anexadas'} são posts que o cliente admira. Use como inspiração de estrutura, ritmo e tom; não copie frases nem marcas.\n` : ''}
Regras da rede: ${NETWORK_RULES[rede]}
Regras do formato: ${FORMAT_RULES[kind]}

Formato exato do JSON (inclua só os campos do formato pedido, além dos comuns):
{
  "gancho": "a primeira frase do conteúdo",
  "legenda": "texto pronto para colar na rede, com quebras de linha (\\n)",
  "hashtags": ["sem o símbolo #"],
  "cta": "a chamada final em uma frase",
  "slides": [{ "titulo": "...", "texto": "..." }],
  "imagem": { "frase": "...", "destaque": "..." },
  "roteiro": { "duracao": "35s", "capa": "...", "cenas": [{ "fala": "...", "visual": "..." }] },
  "stories": [{ "tipo": "texto|enquete|caixinha|link", "texto": "...", "opcoes": ["...", "..."] }],
  "partes": ["..."],
  "dica": "uma dica prática de publicação (horário, primeiro comentário, o que responder)"
}`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Resposta sem JSON');
  return JSON.parse(text.slice(start, end + 1));
}

export async function generatePost(input: GenerateInput): Promise<{ content: PostContent; source: 'ai' | 'demo' }> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return { content: demoContent(input), source: 'demo' };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 3000,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...[input.foto, ...(input.referencias ?? [])]
            .filter((x): x is InputImage => !!x)
            .map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
          { type: 'text' as const, text: promptFor(input) },
        ],
      },
    ],
  });
  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  return { content: normalizeContent(extractJson(text), input), source: 'ai' };
}

/** Ajusta um conteúdo pronto conforme o pedido da pessoa. Devolve o conteúdo novo e uma frase do que mudou. */
export async function revisePost(input: GenerateInput & { current: PostContent; pedido: string }): Promise<{ content: PostContent; resposta: string }> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('IA indisponível');
  const { current, pedido } = input;
  const atual = {
    gancho: current.gancho,
    legenda: current.legenda,
    hashtags: current.hashtags,
    cta: current.cta,
    slides: current.slides,
    imagem: current.imagem,
    roteiro: current.roteiro,
    stories: current.stories,
    partes: current.partes,
    dica: current.dica,
  };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 3000,
    system: `${SYSTEM}
Agora você está AJUSTANDO um conteúdo que já existe, a pedido do cliente. Mude só o que o pedido exige e mantenha o resto igual (mesmo formato, mesma rede, mesmo tema, salvo se o pedido mandar mudar). Se o pedido for impossível ou contrário às regras (inventar números, depoimentos, fatos), faça o mais próximo possível sem inventar e explique em "resposta".`,
    messages: [
      {
        role: 'user',
        content: [
          ...(input.foto ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: input.foto.mediaType, data: input.foto.data } }] : []),
          {
            type: 'text' as const,
            text: `${promptFor(input)}

Conteúdo atual (JSON):
${JSON.stringify(atual)}

Pedido do cliente:
"""${pedido}"""

Devolva o JSON COMPLETO do conteúdo ajustado, no mesmo formato acima, e mais o campo "resposta": uma frase curta (até 25 palavras), em segunda pessoa, dizendo o que você mudou.`,
          },
        ],
      },
    ],
  });
  const text = message.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const raw = extractJson(text) as Record<string, unknown>;
  const content = normalizeContent(raw, input);
  // Mantém o que é da pessoa: estilo, foto, vídeo e edições visuais (se o texto das imagens não mudou).
  if (current.estilo) content.estilo = current.estilo;
  if (current.foto) content.foto = current.foto;
  if (current.video) content.video = current.video;
  const sameVisual =
    JSON.stringify(content.slides ?? null) === JSON.stringify(current.slides ?? null) &&
    JSON.stringify(content.imagem ?? null) === JSON.stringify(current.imagem ?? null) &&
    (content.roteiro?.capa ?? '') === (current.roteiro?.capa ?? '');
  if (current.canvas && sameVisual) content.canvas = current.canvas;
  const resposta = typeof raw.resposta === 'string' && raw.resposta.trim() ? raw.resposta.trim().slice(0, 240) : 'Pronto, ajustei o conteúdo.';
  return { content, resposta };
}

// ---------------------------------------------------------------------------
// Normalização (a tela sempre recebe o que precisa)
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = '', max = 4000) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback);
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function normalizeContent(raw: unknown, input: GenerateInput): PostContent {
  const r = isObj(raw) ? raw : {};
  const demo = demoContent(input);
  const kind = kindOf(input.item.formato);
  const out: PostContent = {
    gancho: str(r.gancho, demo.gancho, 300),
    legenda: str(r.legenda, demo.legenda, 5000),
    hashtags: arr<unknown>(r.hashtags)
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.replace(/^#/, '').replace(/\s+/g, '').slice(0, 40))
      .filter(Boolean)
      .slice(0, 6),
    cta: str(r.cta, demo.cta, 300),
    dica: str(r.dica, demo.dica ?? '', 500) || undefined,
    estilo: 'notas',
  };

  if (kind === 'carrossel') {
    const slides = arr<unknown>(r.slides)
      .filter(isObj)
      .map((s) => ({ titulo: str(s.titulo, '', 120), texto: str(s.texto, '', 400) }))
      .filter((s) => s.titulo || s.texto)
      .slice(0, 8);
    out.slides = slides.length >= 3 ? slides : demo.slides;
  }
  if (kind === 'imagem' || kind === 'prova') {
    const im = isObj(r.imagem) ? r.imagem : {};
    const frase = str(im.frase, demo.imagem!.frase, 300);
    const destaque = str(im.destaque, '', 120);
    out.imagem = { frase, destaque: destaque && frase.includes(destaque) ? destaque : undefined };
  }
  if (kind === 'video') {
    const ro = isObj(r.roteiro) ? r.roteiro : {};
    const cenas = arr<unknown>(ro.cenas)
      .filter(isObj)
      .map((c) => ({ fala: str(c.fala, '', 500), visual: str(c.visual, '', 300) }))
      .filter((c) => c.fala)
      .slice(0, 8);
    out.roteiro = {
      duracao: str(ro.duracao, demo.roteiro!.duracao, 20),
      capa: str(ro.capa, demo.roteiro!.capa, 80),
      cenas: cenas.length >= 2 ? cenas : demo.roteiro!.cenas,
    };
  }
  if (kind === 'stories') {
    const tipos = ['texto', 'enquete', 'caixinha', 'link'];
    const stories = arr<unknown>(r.stories)
      .filter(isObj)
      .map((s) => {
        const tipo = (tipos.includes(String(s.tipo)) ? s.tipo : 'texto') as Story['tipo'];
        const opcoes = arr<unknown>(s.opcoes).filter((o): o is string => typeof o === 'string').map((o) => o.slice(0, 30)).slice(0, 2);
        return { tipo, texto: str(s.texto, '', 300), ...(tipo === 'enquete' ? { opcoes: opcoes.length === 2 ? opcoes : ['Sim', 'Não'] } : {}) };
      })
      .filter((s) => s.texto)
      .slice(0, 6);
    out.stories = stories.length >= 2 ? stories : demo.stories;
  }
  if (kind === 'thread') {
    const partes = arr<unknown>(r.partes).filter((p): p is string => typeof p === 'string' && !!p.trim()).map((p) => p.trim().slice(0, 500)).slice(0, 8);
    out.partes = partes.length >= 3 ? partes : demo.partes;
  }
  return out;
}

/** Limpa o que a pessoa editou na tela antes de salvar. O editor visual só vale para Pro e Multi. */
export function sanitizeEdit(raw: unknown, current: PostContent, opts: { allowCanvas: boolean; mediaIds: Set<number>; videoIds?: Set<number> }): PostContent {
  const r = isObj(raw) ? raw : {};
  const next: PostContent = { ...current };
  if ('foto' in r) {
    if (r.foto === null || r.foto === undefined) delete next.foto;
    else if (Number.isInteger(r.foto) && opts.mediaIds.has(r.foto as number)) next.foto = r.foto as number;
  }
  if ('video' in r) {
    if (r.video === null || r.video === undefined) delete next.video;
    else if (Number.isInteger(r.video) && (opts.videoIds ?? opts.mediaIds).has(r.video as number)) next.video = r.video as number;
  }
  if (opts.allowCanvas && 'canvas' in r) {
    if (!isObj(r.canvas)) delete next.canvas;
    else {
      const out: Record<string, Scene> = {};
      for (const [k, v] of Object.entries(r.canvas).slice(0, 12)) {
        const scene = sanitizeScene(v);
        if (scene && /^[a-z0-9-]{1,20}$/.test(k)) {
          // só fotos da própria pessoa
          scene.layers = scene.layers.filter((l) => l.type !== 'image' || opts.mediaIds.has(l.media));
          out[k] = scene;
        }
      }
      if (Object.keys(out).length) next.canvas = out;
      else delete next.canvas;
    }
  }
  if (typeof r.gancho === 'string') next.gancho = r.gancho.slice(0, 300);
  if (typeof r.legenda === 'string') next.legenda = r.legenda.slice(0, 5000);
  if (typeof r.cta === 'string') next.cta = r.cta.slice(0, 300);
  if (Array.isArray(r.hashtags))
    next.hashtags = r.hashtags.filter((h): h is string => typeof h === 'string').map((h) => h.replace(/^#/, '').replace(/\s+/g, '').slice(0, 40)).filter(Boolean).slice(0, 10);
  if (r.estilo === 'notas' || r.estilo === 'claro' || r.estilo === 'escuro') next.estilo = r.estilo;
  if (Array.isArray(r.slides) && current.slides)
    next.slides = r.slides.filter(isObj).map((s) => ({ titulo: str(s.titulo, '', 120), texto: typeof s.texto === 'string' ? s.texto.slice(0, 400) : '' })).slice(0, 10);
  if (isObj(r.imagem) && current.imagem) {
    const frase = typeof r.imagem.frase === 'string' ? r.imagem.frase.slice(0, 300) : current.imagem.frase;
    const destaque = typeof r.imagem.destaque === 'string' ? r.imagem.destaque.slice(0, 120) : current.imagem.destaque;
    next.imagem = { frase, destaque: destaque && frase.includes(destaque) ? destaque : undefined };
  }
  if (isObj(r.roteiro) && current.roteiro) {
    next.roteiro = {
      duracao: typeof r.roteiro.duracao === 'string' ? r.roteiro.duracao.slice(0, 20) : current.roteiro.duracao,
      capa: typeof r.roteiro.capa === 'string' ? r.roteiro.capa.slice(0, 80) : current.roteiro.capa,
      cenas: Array.isArray(r.roteiro.cenas)
        ? r.roteiro.cenas.filter(isObj).map((c) => ({ fala: typeof c.fala === 'string' ? c.fala.slice(0, 500) : '', visual: typeof c.visual === 'string' ? c.visual.slice(0, 300) : '' })).slice(0, 10)
        : current.roteiro.cenas,
    };
  }
  if (Array.isArray(r.stories) && current.stories)
    next.stories = r.stories
      .filter(isObj)
      .map((s, i) => ({ ...(current.stories![i] ?? { tipo: 'texto' as const }), texto: typeof s.texto === 'string' ? s.texto.slice(0, 300) : '' }))
      .slice(0, 8);
  if (Array.isArray(r.partes) && current.partes) next.partes = r.partes.filter((p): p is string => typeof p === 'string').map((p) => p.slice(0, 500)).slice(0, 10);
  return next;
}

// ---------------------------------------------------------------------------
// Modo demonstração (sem chave de IA)
// ---------------------------------------------------------------------------

export function demoContent({ strategy, item }: GenerateInput): PostContent {
  const pilar = strategy.pilares[item.pilar]?.nome ?? 'seu tema';
  const gancho = `${item.tema}: o que quase ninguém te conta.`;
  const base: PostContent = {
    gancho,
    legenda: `${gancho}\n\n[Conte aqui uma situação real do seu dia a dia sobre ${pilar.toLowerCase()}.]\n\nO que aprendi: [a lição em uma frase].\n\nE você, já passou por isso?`,
    hashtags: [pilar.replace(/\s+/g, '').toLowerCase()],
    cta: 'Salve para lembrar e mande para quem precisa ver isso.',
    dica: `Publique perto das ${strategy.ritmo.horario} e responda os comentários na primeira hora.`,
    estilo: 'notas',
  };
  const kind = kindOf(item.formato);
  if (kind === 'carrossel')
    base.slides = [
      { titulo: item.tema, texto: 'Arraste para o lado →' },
      { titulo: 'O erro mais comum', texto: '[Descreva o erro que seu cliente comete.]' },
      { titulo: 'Por que acontece', texto: '[Explique a causa em uma frase.]' },
      { titulo: 'O que fazer', texto: '[O primeiro passo prático.]' },
      { titulo: 'Salve este post', texto: base.cta },
    ];
  if (kind === 'imagem' || kind === 'prova')
    base.imagem = kind === 'prova' ? { frase: '[Cole aqui o depoimento do seu cliente]' } : { frase: `${item.tema}. Simples assim.`, destaque: 'Simples assim.' };
  if (kind === 'video')
    base.roteiro = {
      duracao: '35s',
      capa: item.tema.slice(0, 40),
      cenas: [
        { fala: gancho, visual: 'Close no rosto ou texto grande na tela.' },
        { fala: '[O problema em uma frase.]', visual: 'Corte rápido.' },
        { fala: '[A virada: o que você faz diferente.]', visual: 'Mostre o processo.' },
        { fala: base.cta, visual: 'Texto na tela com a chamada.' },
      ],
    };
  if (kind === 'stories')
    base.stories = [
      { tipo: 'texto', texto: gancho },
      { tipo: 'enquete', texto: 'Isso acontece com você?', opcoes: ['Sempre', 'Às vezes'] },
      { tipo: 'caixinha', texto: 'Qual a sua maior dúvida sobre isso?' },
      { tipo: 'link', texto: 'Quer ajuda com isso? Toque no link.' },
    ];
  if (kind === 'thread') base.partes = [gancho, '[Ponto 1]', '[Ponto 2]', '[Ponto 3]', base.cta];
  return base;
}

