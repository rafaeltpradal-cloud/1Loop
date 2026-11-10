// A IA escolhe (ou preenche, quando a pessoa pede um formato) o "formato real" da imagem de um post já pronto.
import Anthropic from '@anthropic-ai/sdk';
import { createJson } from '@/lib/aiJson';
import { arteRules, ARTE_TIPOS, sanitizeArte, type Arte, type ArteTipo } from '@/lib/arte';
import { kindOf, type PostContent } from '@/lib/contentTypes';

const SYSTEM = `Você é diretor de arte da 1loop creators. Transforma o conteúdo de um post numa imagem que parece feita por gente de verdade (print, conversa, checklist, gráfico, anotação, caderno), nunca um cartão genérico com cara de IA.
Escreva em português do Brasil, na voz da pessoa, curto e legível no celular. Não invente fatos, números, clientes nem depoimentos.
Responda SOMENTE com um objeto JSON válido.`;

export async function generateArte(input: { formato: string; content: PostContent; tipo?: ArteTipo; contexto?: string; recentes?: string[] }): Promise<Arte | null> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return null;
  const kind = kindOf(input.formato) === 'carrossel' ? 'carrossel' : 'imagem';
  if (kind === 'carrossel') return { tipo: 'documento' };
  const c = input.content;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() });
  const pedido = input.tipo
    ? `Use OBRIGATORIAMENTE o formato "${input.tipo}" (${ARTE_TIPOS.find((t) => t.id === input.tipo)?.nome ?? input.tipo}).`
    : 'Escolha o formato que conta melhor esta ideia (diferente de "frase").';
  const prompt = `Post (${input.formato}):
Gancho: ${c.gancho}
${c.imagem?.frase ? `Frase da imagem atual: ${c.imagem.frase}\n` : ''}Legenda:
<<<
${c.legenda.slice(0, 2500)}
>>>
${input.contexto ? `\nContexto real da pessoa (únicos números que podem aparecer como valores):\n${input.contexto.slice(0, 3000)}\n` : ''}
${input.content.arte ? `Formato atual: ${JSON.stringify(input.content.arte)}. Faça uma versão diferente.\n` : ''}
${arteRules('imagem', input.recentes)}

${pedido}
JSON: { "arte": { ... } }`;
  const parsed = (await createJson(client, {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  })) as { arte?: unknown };
  const arte = sanitizeArte(parsed?.arte ?? parsed, 'imagem');
  if (!arte || arte.tipo === 'frase') return null;
  if (input.tipo && arte.tipo !== input.tipo) return null;
  return arte;
}
