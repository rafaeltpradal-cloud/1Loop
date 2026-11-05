// A IA cria a identidade visual de cada pessoa (lib/visual.ts): olha as referências que ela subiu
// (cores, tipografia, composição) e a entrevista (área, público, tom) e devolve um visual único.
// Também cria um visual novo para um post, a pedido ("mais minimalista", "fundo escuro").
import Anthropic from '@anthropic-ai/sdk';
import type { createAdminClient } from '@/lib/supabase/admin';
import { createJson } from '@/lib/aiJson';
import { interviewText, type InputImage } from '@/lib/content';
import type { Answers } from '@/lib/interview';
import { DEFAULT_VISUAL, FONT_LABELS, LAYOUT_LABELS, LAYOUTS, sanitizeVisual, variantFor, type Visual } from '@/lib/visual';
import type { Strategy } from '@/lib/strategy';
import type { PostContent } from '@/lib/contentTypes';

type Admin = ReturnType<typeof createAdminClient>;

const SYSTEM = `Você é diretor de arte da 1loop creators. Cria a identidade visual dos posts de redes sociais (LinkedIn e Instagram) de UMA pessoa específica.
O visual tem de ser moderno, com cara de marca profissional, e PARECER DELA: nasce das referências que ela escolheu e de quem ela é (área, público, tom, onde quer chegar).
Regras:
- Se houver imagens de referência, elas mandam: tire das referências as cores reais (em hexadecimal), o clima (claro/escuro, sóbrio/vibrante), o tipo de letra (serifada, geométrica, condensada, mono) e a composição (respiro, blocos, formas). Não copie logotipos nem textos delas.
- Sem referências, deduza da entrevista: jurídico/finanças/consultoria tendem a sóbrio e editorial; tecnologia/dados a geométrico ou mono; criativos/marketing a ousado e colorido; saúde/bem-estar a leve e arejado. Mesmo assim, fuja do óbvio.
- Fuja do genérico: nada de "bloco de notas", nada do degradê roxo-azul padrão de app, nada de preto e branco sem personalidade (a não ser que as referências peçam).
- Garanta leitura: a cor da tinta precisa de bom contraste com o fundo; a cor de destaque precisa aparecer bem sobre o fundo.
- Escolha de 2 a 4 layouts que combinem com essa identidade, para os posts variarem entre eles.
Responda SOMENTE com um objeto JSON válido.`;

function schema() {
  return `Opções:
Fontes (use a chave): ${Object.entries(FONT_LABELS).map(([k, v]) => `"${k}" = ${v}`).join('; ')}.
Layouts: ${LAYOUTS.map((l) => `"${l}" = ${LAYOUT_LABELS[l]}`).join('; ')}.
Fundo: "solido", "gradiente" (do fundo para fundo2), "radial", "grade", "pontos", "listras".
Destaque do trecho marcado: "gradiente" (texto em degradê acento→acento2), "caixa" (bloco de cor atrás), "pincel" (marca-texto), "sublinhado" (traço grosso), "cor" (só a cor de destaque).
Forma decorativa: "nenhuma", "circulo", "arco", "barra", "moldura".

JSON exato:
{
  "nome": "nome curto do visual, ex.: Editorial terracota",
  "porque": "uma frase dizendo de onde veio (referências e perfil)",
  "layouts": ["2 a 4 layouts"],
  "layout": "o principal",
  "titulo": "fonte dos títulos",
  "texto": "fonte do texto de apoio (não use display)",
  "peso": 600 | 700 | 800,
  "caixaAlta": true | false,
  "cores": { "fundo": "#RRGGBB", "fundo2": "#RRGGBB", "tinta": "#RRGGBB", "suave": "#RRGGBB", "acento": "#RRGGBB", "acento2": "#RRGGBB" },
  "fundo": "...",
  "destaque": "...",
  "forma": "...",
  "raio": 0 a 48,
  "alinhamento": "left" | "center"
}`;
}

/** Cria um visual (da marca ou de um post). Sem IA disponível, devolve o padrão. */
export async function generateVisual(input: { answers: Answers; referencias?: InputImage[]; pedido?: string; atual?: Visual | null; foto?: InputImage }): Promise<{ visual: Visual; porque: string }> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return { visual: DEFAULT_VISUAL, porque: '' };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() });
  const refs = (input.referencias ?? []).slice(0, 4);
  const imgs = [...refs, ...(input.foto ? [input.foto] : [])];
  const prompt = `Quem é a pessoa (entrevista):
${interviewText(input.answers) || '- (sem entrevista)'}

${refs.length ? `As ${refs.length} primeiras imagens anexadas são as REFERÊNCIAS de estilo que a pessoa escolheu. Analise cores, tipografia e composição delas.` : 'A pessoa ainda não subiu referências de estilo.'}
${input.foto ? 'A última imagem anexada é a foto que vai no post: o visual precisa combinar com ela.' : ''}
${input.atual ? `Visual atual (crie algo DIFERENTE deste, ainda coerente com a pessoa): ${JSON.stringify({ nome: input.atual.nome, layout: input.atual.layout, titulo: input.atual.titulo, cores: input.atual.cores, fundo: input.atual.fundo })}` : ''}
${input.pedido ? `Pedido da pessoa para o visual: """${input.pedido.slice(0, 400)}"""` : ''}

${schema()}`;
  const parsed = (await createJson(client, {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 1200,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...imgs.map((img) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: img.mediaType, data: img.data } })),
          { type: 'text' as const, text: prompt },
        ],
      },
    ],
  })) as Record<string, unknown>;
  const visual = sanitizeVisual(parsed) ?? DEFAULT_VISUAL;
  const porque = typeof parsed?.porque === 'string' ? parsed.porque.slice(0, 240) : '';
  return { visual, porque };
}

/** Baixa uma imagem da biblioteca para mandar à IA. */
export async function mediaImage(admin: Admin, path: string): Promise<InputImage | undefined> {
  const { data } = await admin.storage.from('media').download(path);
  if (!data) return undefined;
  const type = data.type === 'image/png' || data.type === 'image/webp' ? data.type : 'image/jpeg';
  return { data: Buffer.from(await data.arrayBuffer()).toString('base64'), mediaType: type };
}

/** Até 4 referências de estilo da marca (as mais recentes). */
export async function referenceImages(admin: Admin, userId: string, brandId: number) {
  const { data } = await admin.from('media').select('path').eq('user_id', userId).eq('brand_id', brandId).eq('kind', 'referencia').order('created_at', { ascending: false }).limit(4);
  const imgs = await Promise.all((data ?? []).map((r) => mediaImage(admin, r.path as string)));
  return imgs.filter((x): x is InputImage => !!x);
}

/** Quem usa um modelo fixo (ex.: bloco de notas) continua nele; os demais usam o visual próprio. */
export const usesBrandVisual = (s: Strategy) => !s.modelo?.estilo;

/**
 * Visual da marca: o que já está na estratégia ou um novo, criado agora e salvo nela.
 * `refazer` cria outro (ex.: depois de subir novas referências).
 */
export async function ensureBrandVisual(admin: Admin, o: { userId: string; brandId: number; strategyId: number; strategy: Strategy; answers: Answers; refazer?: boolean; pedido?: string }): Promise<Visual> {
  if (o.strategy.visual && !o.refazer) return o.strategy.visual;
  const referencias = await referenceImages(admin, o.userId, o.brandId);
  const { visual } = await generateVisual({ answers: o.answers, referencias, pedido: o.pedido, atual: o.refazer ? o.strategy.visual : null });
  // Relê a estratégia antes de gravar, para não apagar nada que mudou nesse meio-tempo.
  const { data: fresh } = await admin.from('strategies').select('data').eq('id', o.strategyId).eq('user_id', o.userId).maybeSingle();
  const data = { ...((fresh?.data as Strategy | undefined) ?? o.strategy), visual };
  await admin.from('strategies').update({ data }).eq('id', o.strategyId).eq('user_id', o.userId);
  return visual;
}

/**
 * Passa os posts ainda não publicados para o visual da marca (cada um numa variação).
 * Não mexe em post publicado/agendado, em post editado no editor visual nem em quem escolheu outro estilo à mão
 * (só troca o "bloco de notas" que vinha por padrão, ou atualiza quem já está no visual da marca).
 */
export async function applyVisualToDrafts(admin: Admin, userId: string, strategyId: number, visual: Visual, alvo: 'padrao' | 'marca') {
  const { data: posts } = await admin.from('posts').select('id, item_index, status, content').eq('user_id', userId).eq('strategy_id', strategyId).in('status', ['rascunho', 'aprovado']);
  let n = 0;
  for (const p of posts ?? []) {
    const c = p.content as PostContent;
    if (c.canvas) continue;
    const padrao = !c.estilo || c.estilo === 'notas';
    const daMarca = c.estilo === 'marca';
    // 1ª vez: troca o bloco de notas que vinha por padrão. Visual refeito: atualiza quem já está nele.
    if (alvo === 'padrao' ? !padrao : !daMarca) continue;
    const next: PostContent = { ...c, estilo: 'marca', visual: variantFor(visual, p.item_index as number) };
    await admin.from('posts').update({ content: next }).eq('id', p.id).eq('user_id', userId);
    n++;
  }
  return n;
}
