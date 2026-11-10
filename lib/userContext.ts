// Contexto do perfil: o que a pessoa conta sobre si (fatos, números, cases, histórias, opiniões, oferta, público).
// Entra no app (/app/contexto) ou pela IA dela via MCP (lib/mcp.ts). Toda geração de post usa como base real.
import type { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

export const CONTEXT_TYPES = [
  { id: 'sobre', nome: 'Sobre mim', dica: 'Trajetória, cargo, empresa, o que você faz de verdade' },
  { id: 'numero', nome: 'Número', dica: 'Resultados, metas, métricas que você pode mostrar' },
  { id: 'case', nome: 'Case', dica: 'Um cliente ou projeto: problema, o que foi feito, resultado' },
  { id: 'historia', nome: 'História', dica: 'Algo que aconteceu e rende post' },
  { id: 'opiniao', nome: 'Opinião', dica: 'O que você defende (ou discorda) no seu mercado' },
  { id: 'oferta', nome: 'Oferta', dica: 'O que você vende, preço, para quem' },
  { id: 'publico', nome: 'Público', dica: 'Quem é seu cliente, dores, objeções que você ouve' },
  { id: 'fato', nome: 'Fato', dica: 'Qualquer outra coisa que a IA deve saber' },
] as const;
export type ContextType = (typeof CONTEXT_TYPES)[number]['id'] | 'outro';
export const isContextType = (v: unknown): v is ContextType => v === 'outro' || CONTEXT_TYPES.some((t) => t.id === v);
export const contextLabel = (t: string) => CONTEXT_TYPES.find((x) => x.id === t)?.nome ?? 'Outro';

export type ContextItem = { id: number; tipo: ContextType; titulo: string | null; texto: string; fonte: 'app' | 'mcp'; created_at: string };
export const CONTEXT_COLUMNS = 'id, tipo, titulo, texto, fonte, created_at';
export const CONTEXT_MAX_ITEMS = 300;

export async function listContext(admin: Admin, userId: string, brandId: number, limit = 100): Promise<ContextItem[]> {
  const { data } = await admin
    .from('user_context')
    .select(CONTEXT_COLUMNS)
    .eq('user_id', userId)
    .or(`brand_id.eq.${brandId},brand_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as ContextItem[];
}

export async function addContext(admin: Admin, userId: string, brandId: number, item: { tipo?: unknown; titulo?: unknown; texto?: unknown }, fonte: 'app' | 'mcp') {
  const texto = typeof item.texto === 'string' ? item.texto.trim().slice(0, 4000) : '';
  if (texto.length < 3) return { error: 'Escreva o contexto (pelo menos uma frase).' } as const;
  const titulo = typeof item.titulo === 'string' && item.titulo.trim() ? item.titulo.trim().slice(0, 120) : null;
  const tipo = isContextType(item.tipo) ? item.tipo : 'fato';
  const { count } = await admin.from('user_context').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  if ((count ?? 0) >= CONTEXT_MAX_ITEMS) return { error: `Você chegou a ${CONTEXT_MAX_ITEMS} itens de contexto. Apague alguns antigos para adicionar novos.` } as const;
  const { data, error } = await admin.from('user_context').insert({ user_id: userId, brand_id: brandId, tipo, titulo, texto, fonte }).select(CONTEXT_COLUMNS).single();
  if (error || !data) return { error: 'Não deu para salvar agora.' } as const;
  return { item: data as ContextItem } as const;
}

export async function deleteContext(admin: Admin, userId: string, id: number) {
  const { error, count } = await admin.from('user_context').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);
  return !error && (count ?? 0) > 0;
}

/**
 * Texto do contexto para a IA: o mais importante primeiro (sobre, oferta, público, números, cases),
 * até ~6 mil caracteres. Vazio se a pessoa ainda não registrou nada.
 */
export async function contextText(admin: Admin, userId: string, brandId: number, max = 6000) {
  const items = await listContext(admin, userId, brandId, 120).catch(() => [] as ContextItem[]);
  if (!items.length) return '';
  const order = ['sobre', 'oferta', 'publico', 'numero', 'case', 'opiniao', 'historia', 'fato', 'outro'];
  items.sort((a, b) => order.indexOf(a.tipo) - order.indexOf(b.tipo));
  let out = '';
  for (const it of items) {
    const line = `- [${contextLabel(it.tipo)}] ${it.titulo ? `${it.titulo}: ` : ''}${it.texto.replace(/\s+/g, ' ').trim()}\n`;
    if (out.length + line.length > max) break;
    out += line;
  }
  return out.trim();
}
