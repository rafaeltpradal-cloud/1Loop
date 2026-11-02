// Social selling: a pessoa cola o post de um cliente ou prospect e recebe 3 comentários na voz dela.
import Anthropic from '@anthropic-ai/sdk';
import { createJson } from '@/lib/aiJson';
import { interviewText } from '@/lib/content';
import type { Answers } from '@/lib/interview';

export type CommentIdea = { tipo: string; texto: string };

const SYSTEM = `Você ajuda profissionais de vendas a comentar posts de clientes e prospects no LinkedIn e no Instagram, em português do Brasil.
Um bom comentário: soma uma ideia ou experiência real, faz a pessoa querer responder, tem 1 a 3 frases, não vende nada, não bajula ("excelente post!"), não usa emoji em excesso nem hashtags.
Escreva na voz do profissional descrito na entrevista, com o vocabulário do mercado dele. Nunca invente números, clientes ou fatos sobre ele.
Responda SOMENTE com um objeto JSON válido.`;

export async function suggestComments(input: { post: string; objetivo?: string; answers: Answers }): Promise<CommentIdea[]> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('IA indisponível');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() });
  const parsed = (await createJson(client, {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 900,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Quem vai comentar (entrevista):
${interviewText(input.answers) || '- (sem entrevista; use um tom profissional e direto)'}

${input.objetivo ? `Objetivo com essa pessoa: ${input.objetivo}\n\n` : ''}Post a comentar:
<<<
${input.post}
>>>

Escreva 3 comentários diferentes:
1. "Concordo e somo": concorda e acrescenta uma experiência ou ângulo prático.
2. "Pergunta": uma pergunta genuína que puxa conversa com o autor.
3. "Outro ângulo": discorda com respeito ou mostra um ponto que o post não cobriu.

JSON: { "comentarios": [ { "tipo": "Concordo e somo", "texto": "..." }, { "tipo": "Pergunta", "texto": "..." }, { "tipo": "Outro ângulo", "texto": "..." } ] }`,
      },
    ],
  })) as { comentarios?: { tipo?: unknown; texto?: unknown }[] };
  return (parsed.comentarios ?? [])
    .map((c) => ({ tipo: String(c.tipo ?? '').slice(0, 40), texto: String(c.texto ?? '').trim().slice(0, 1200) }))
    .filter((c) => c.texto)
    .slice(0, 3);
}
