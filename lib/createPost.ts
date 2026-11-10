// "Crie seu post": a pessoa traz a foto e/ou o texto e pede à IA o que quiser ("a partir desta foto, conta que…").
import Anthropic from '@anthropic-ai/sdk';
import { createJson } from '@/lib/aiJson';
import { interviewText, NETWORK_RULES, type InputImage } from '@/lib/content';
import type { Answers } from '@/lib/interview';
import { localize, type Market } from '@/lib/market';

export type Draft = { legenda: string; hashtags: string[] };

const SYSTEM = `Você é o redator da 1loop creators. A pessoa está montando o próprio post e te pede ajuda com a legenda.
Faça exatamente o que ela pediu: escrever do zero, reescrever, encurtar, mudar o tom, criar a partir da foto etc.
- Escreva em português do Brasil, em primeira pessoa, na voz dela (use a entrevista para tom, vocabulário e posicionamento).
- Gancho forte na primeira linha. Frases curtas. Nada de clichê de coach, nada de "neste post vou falar".
- Use só fatos que estão no pedido, no texto dela, na foto ou na entrevista. Não invente números, clientes, nomes, resultados ou acontecimentos. Se faltar um dado importante, use [marcador entre colchetes] para ela completar.
- Se houver foto, ela vai publicada junto: aproveite o que aparece nela, sem afirmar o que a foto não mostra.
Responda SOMENTE com um objeto JSON válido.`;

export async function writeDraft(input: { pedido: string; texto: string; rede: string; answers: Answers; foto?: InputImage; market?: Market; contexto?: string }): Promise<Draft> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error('IA indisponível');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim() });
  const rede = NETWORK_RULES[input.rede] ? input.rede : 'LinkedIn';
  const prompt = `Quem escreve (entrevista):
${interviewText(input.answers) || '- (sem entrevista; tom profissional e direto)'}
${input.contexto ? `
Contexto real que a pessoa registrou (fatos, números, cases; pode usar como base):
${input.contexto}
` : ''}
Rede: ${rede}. Regras da rede: ${NETWORK_RULES[rede]}
${input.foto ? 'Foto: a imagem anexada vai publicada com o post.\n' : 'Sem foto.\n'}
${input.texto ? `Texto que a pessoa já escreveu:\n<<<\n${input.texto}\n>>>\n` : 'Ainda não há texto.\n'}
Pedido da pessoa: ${input.pedido || 'Escreva a legenda deste post.'}

JSON: { "legenda": "texto completo pronto para colar, com quebras de linha (\\n), sem hashtags no meio", "hashtags": ["até 5, sem #; vazio se não fizer sentido"] }`;
  const parsed = (await createJson(client, {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    max_tokens: 1800,
    system: localize(SYSTEM, input.market),
    messages: [
      {
        role: 'user',
        content: [
          ...(input.foto ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: input.foto.mediaType, data: input.foto.data } }] : []),
          { type: 'text' as const, text: prompt },
        ],
      },
    ],
  })) as { legenda?: unknown; hashtags?: unknown };
  const legenda = String(parsed.legenda ?? '').trim().slice(0, 5000);
  if (!legenda) throw new Error('vazio');
  const hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean).slice(0, 5) : [];
  return { legenda, hashtags };
}
