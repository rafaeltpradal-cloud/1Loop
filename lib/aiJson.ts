// Tipos mínimos para não depender dos tipos sobrecarregados do SDK.
type Msg = { role: 'user' | 'assistant'; content: unknown };
type Params = { model: string; max_tokens: number; system?: string; messages: Msg[] };
type Reply = { stop_reason?: string | null; content: Array<{ type: string; text?: string }> };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { messages: { create: (p: any) => Promise<any> } };

function extract(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Resposta sem JSON');
  return JSON.parse(text.slice(start, end + 1));
}

const textOf = (m: Reply) => m.content.map((b) => (b.type === 'text' ? b.text ?? '' : '')).join('');

/** Pede um JSON à IA. Se a resposta vier sem JSON válido, pede de novo uma vez, só o JSON. */
export async function createJson(client: Client, params: Params): Promise<unknown> {
  const first = (await client.messages.create(params)) as Reply;
  const text = textOf(first);
  try {
    return extract(text);
  } catch (err) {
    console.warn('[ia json] 1ª resposta sem JSON', first.stop_reason, text.slice(0, 300));
    const retry = (await client.messages.create({
      ...params,
      messages: [
        ...params.messages,
        { role: 'assistant', content: text.trim() || '(sem resposta)' },
        { role: 'user', content: 'Responda agora SOMENTE com o objeto JSON completo pedido, sem nenhum texto antes ou depois, sem perguntas.' },
      ],
    })) as Reply;
    const t2 = textOf(retry);
    try {
      return extract(t2);
    } catch {
      console.error('[ia json] 2ª resposta sem JSON', retry.stop_reason, t2.slice(0, 300));
      throw err;
    }
  }
}
