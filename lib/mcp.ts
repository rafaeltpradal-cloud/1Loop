// Servidor MCP da 1loop: liga a IA da pessoa (Claude, ChatGPT, Cursor…) ao perfil dela na 1loop.
// A IA lê quem a pessoa é (entrevista, estratégia), lê e ajusta os posts e, principalmente, ALIMENTA o contexto
// (fatos, números, cases, histórias) que a 1loop usa para escrever. Transporte "Streamable HTTP" sem estado,
// respostas em JSON. Autenticação: token pessoal no link (/api/mcp/<token>) ou no cabeçalho Authorization: Bearer.
import { createHash, randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { accessFor } from '@/lib/access';
import { interviewText } from '@/lib/content';
import { resolveAnswers, sanitizeAnswers } from '@/lib/interview';
import { captionWithTags, type PostContent } from '@/lib/contentTypes';
import type { Strategy } from '@/lib/strategy';
import { siteUrl } from '@/lib/stripe';
import { addContext, CONTEXT_TYPES, contextLabel, deleteContext, listContext } from '@/lib/userContext';

type Admin = ReturnType<typeof createAdminClient>;
type Who = { userId: string; brandId: number; tokenId: number };

export const MCP_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER = { name: '1loop-creators', title: '1loop creators', version: '1.0.0' };

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/** Cria um link novo para a marca (revoga os anteriores dela). Devolve o token puro, mostrado uma vez. */
export async function createMcpToken(admin: Admin, userId: string, brandId: number) {
  const token = `1lp_${randomBytes(24).toString('base64url')}`;
  await admin.from('mcp_tokens').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).eq('brand_id', brandId).is('revoked_at', null);
  const { error } = await admin.from('mcp_tokens').insert({ user_id: userId, brand_id: brandId, token_hash: hashToken(token), hint: token.slice(-4) });
  if (error) throw error;
  return token;
}

export async function revokeMcpTokens(admin: Admin, userId: string, brandId: number) {
  await admin.from('mcp_tokens').update({ revoked_at: new Date().toISOString() }).eq('user_id', userId).eq('brand_id', brandId).is('revoked_at', null);
}

export async function activeMcpToken(admin: Admin, userId: string, brandId: number) {
  const { data } = await admin.from('mcp_tokens').select('id, hint, created_at, last_used_at').eq('user_id', userId).eq('brand_id', brandId).is('revoked_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data as { id: number; hint: string; created_at: string; last_used_at: string | null } | null;
}

async function whoIs(admin: Admin, token: string): Promise<Who | null> {
  if (!/^1lp_[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const { data } = await admin.from('mcp_tokens').select('id, user_id, brand_id, last_used_at').eq('token_hash', hashToken(token)).is('revoked_at', null).maybeSingle();
  if (!data) return null;
  // Marca o uso (no máximo 1 vez a cada 10 min, para não escrever a cada chamada).
  if (!data.last_used_at || Date.now() - Date.parse(data.last_used_at as string) > 600000)
    await admin.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id);
  return { userId: data.user_id as string, brandId: data.brand_id as number, tokenId: data.id as number };
}

// ---------------------------------------------------------------------------
// Ferramentas
// ---------------------------------------------------------------------------

const tipos = CONTEXT_TYPES.map((t) => t.id);

const TOOLS = [
  {
    name: 'get_profile',
    title: 'Perfil na 1loop',
    description:
      'Quem é a pessoa na 1loop creators: respostas da entrevista (trajetória, público, oferta, tom), estratégia de conteúdo atual (objetivo, posicionamento, pilares, série, ritmo) e quantos itens de contexto já existem. Use antes de escrever qualquer coisa para ela.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_context',
    title: 'Ver contexto',
    description: 'Lista o contexto que a pessoa já registrou na 1loop (fatos, números, cases, histórias, opiniões, oferta, público). A 1loop usa isso como base real para escrever os posts.',
    inputSchema: { type: 'object', properties: { tipo: { type: 'string', enum: [...tipos, 'outro'], description: 'Filtrar por tipo (opcional).' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_context',
    title: 'Adicionar contexto',
    description: `Salva no perfil da pessoa na 1loop um fato, número, case, história, opinião, oferta ou detalhe do público, para os próximos posts saírem mais específicos e verdadeiros. Use quando a pessoa contar algo sobre o trabalho dela, um resultado, um cliente (sem dados sensíveis) ou uma opinião. Registre SÓ o que ela disse ou confirmou; não invente. Um item por assunto, texto objetivo. Tipos: ${CONTEXT_TYPES.map((t) => `"${t.id}" (${t.dica})`).join('; ')}.`,
    inputSchema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: [...tipos, 'outro'] },
        titulo: { type: 'string', description: 'Título curto (opcional), até 120 caracteres.' },
        texto: { type: 'string', description: 'O contexto em si, até 4.000 caracteres.' },
      },
      required: ['tipo', 'texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_context',
    title: 'Apagar contexto',
    description: 'Apaga um item de contexto pelo id (veja os ids em list_context). Só quando a pessoa pedir.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false },
    annotations: { destructiveHint: true },
  },
  {
    name: 'list_posts',
    title: 'Ver posts',
    description: 'Lista os posts da pessoa na 1loop (data, rede, formato, status, tema e primeira frase). Status: rascunho, aprovado, agendado, publicando, publicado, erro.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['rascunho', 'aprovado', 'agendado', 'publicado', 'erro'] },
        desde: { type: 'string', description: 'Data mínima AAAA-MM-DD (opcional).' },
        limite: { type: 'integer', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_post',
    title: 'Ver post',
    description: 'Conteúdo completo de um post (texto pronto para publicar, slides do carrossel, roteiro, imagem), pelo id.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'], additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'update_post',
    title: 'Editar post',
    description:
      'Troca o texto de um post que ainda não foi publicado nem agendado (rascunho ou aprovado): primeira frase, legenda completa, hashtags e chamada final. Mantém imagem, data e rede. Use quando a pessoa pedir para reescrever um post da 1loop. Mostre a versão a ela antes de salvar.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        gancho: { type: 'string', description: 'Primeira frase.' },
        legenda: { type: 'string', description: 'Texto completo para publicar, com quebras de linha.' },
        hashtags: { type: 'array', items: { type: 'string' }, description: 'Sem o símbolo #.' },
        cta: { type: 'string', description: 'Chamada final em uma frase.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

type Args = Record<string, unknown>;
const text = (t: string, isError = false) => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError: true } : {}) });
const json = (o: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 2) }], structuredContent: o });

async function callTool(admin: Admin, who: Who, name: string, args: Args) {
  const { userId, brandId } = who;
  switch (name) {
    case 'get_profile': {
      const [{ data: profile }, { data: brand }, { data: interview }, { data: st }, ctx] = await Promise.all([
        admin.from('profiles').select('name').eq('id', userId).maybeSingle(),
        admin.from('brands').select('name').eq('id', brandId).maybeSingle(),
        admin.from('interviews').select('answers').eq('user_id', userId).eq('brand_id', brandId).maybeSingle(),
        admin.from('strategies').select('data, created_at').eq('user_id', userId).eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        listContext(admin, userId, brandId, 300),
      ]);
      const s = st?.data as Strategy | undefined;
      return json({
        nome: profile?.name ?? null,
        marca: brand?.name ?? null,
        entrevista: interviewText(resolveAnswers(sanitizeAnswers(interview?.answers ?? {}))) || null,
        estrategia: s
          ? {
              objetivo: s.objetivo,
              posicionamento: s.posicionamento,
              pilares: s.pilares?.map((p) => ({ nome: p.nome, descricao: p.descricao })),
              serie: s.serie ? { nome: s.serie.nome, descricao: s.serie.descricao } : null,
              ritmo: s.ritmo,
              redes: [...new Set((s.calendario ?? []).map((c) => c.rede))],
            }
          : null,
        contexto_itens: ctx.length,
        app: `${siteUrl()}/app`,
      });
    }
    case 'list_context': {
      let items = await listContext(admin, userId, brandId, 300);
      if (typeof args.tipo === 'string') items = items.filter((i) => i.tipo === args.tipo);
      return json({ itens: items.map((i) => ({ id: i.id, tipo: i.tipo, tipo_nome: contextLabel(i.tipo), titulo: i.titulo, texto: i.texto, origem: i.fonte, criado_em: i.created_at })) });
    }
    case 'add_context': {
      const r = await addContext(admin, userId, brandId, args, 'mcp');
      if ('error' in r) return text(r.error ?? 'Não deu para salvar.', true);
      return json({ ok: true, id: r.item.id, mensagem: 'Salvo no contexto da 1loop. Os próximos posts já usam isso.' });
    }
    case 'delete_context': {
      const id = Number(args.id);
      if (!Number.isInteger(id)) return text('Informe o id do item.', true);
      return (await deleteContext(admin, userId, id)) ? json({ ok: true }) : text('Item não encontrado.', true);
    }
    case 'list_posts': {
      const limite = Math.min(50, Math.max(1, Number(args.limite) || 20));
      let q = admin.from('posts').select('id, date, rede, formato, status, tema, content, scheduled_at, external_url').eq('user_id', userId).eq('brand_id', brandId).neq('source', 'demo');
      if (typeof args.status === 'string') q = q.eq('status', args.status);
      if (typeof args.desde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.desde)) q = q.gte('date', args.desde);
      const { data } = await q.order('date', { ascending: false }).limit(limite);
      return json({
        posts: (data ?? []).map((p) => ({
          id: p.id,
          data: p.date,
          rede: p.rede,
          formato: p.formato,
          status: p.status,
          tema: p.tema,
          gancho: (p.content as PostContent | null)?.gancho ?? null,
          agendado_para: p.scheduled_at,
          link_publicado: p.external_url,
          abrir: `${siteUrl()}/app/conteudos/${p.id}`,
        })),
      });
    }
    case 'get_post': {
      const id = Number(args.id);
      const { data: p } = await admin.from('posts').select('id, date, rede, formato, status, tema, content, external_url').eq('id', id).eq('user_id', userId).eq('brand_id', brandId).maybeSingle();
      if (!p) return text('Post não encontrado.', true);
      const c = p.content as PostContent;
      return json({
        id: p.id,
        data: p.date,
        rede: p.rede,
        formato: p.formato,
        status: p.status,
        tema: p.tema,
        gancho: c.gancho,
        texto_para_publicar: captionWithTags(c),
        cta: c.cta,
        slides: c.slides,
        imagem: c.imagem,
        formato_da_imagem: c.arte ?? null,
        roteiro: c.roteiro,
        stories: c.stories,
        partes: c.partes,
        link_publicado: p.external_url,
        abrir: `${siteUrl()}/app/conteudos/${p.id}`,
      });
    }
    case 'update_post': {
      const id = Number(args.id);
      const { data: p } = await admin.from('posts').select('id, status, content').eq('id', id).eq('user_id', userId).eq('brand_id', brandId).maybeSingle();
      if (!p) return text('Post não encontrado.', true);
      if (!['rascunho', 'aprovado'].includes(p.status as string)) return text(`Este post está "${p.status}". Só dá para editar rascunhos e aprovados.`, true);
      const c = { ...(p.content as PostContent) };
      if (typeof args.gancho === 'string' && args.gancho.trim()) c.gancho = args.gancho.trim().slice(0, 300);
      if (typeof args.legenda === 'string' && args.legenda.trim()) c.legenda = args.legenda.trim().slice(0, 5000);
      if (typeof args.cta === 'string' && args.cta.trim()) c.cta = args.cta.trim().slice(0, 300);
      if (Array.isArray(args.hashtags))
        c.hashtags = args.hashtags.filter((h): h is string => typeof h === 'string').map((h) => h.replace(/^#/, '').replace(/\s+/g, '').slice(0, 40)).filter(Boolean).slice(0, 10);
      // Volta para revisão: a pessoa confere no app antes de publicar.
      const { error } = await admin.from('posts').update({ content: c, status: 'rascunho', updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId);
      if (error) return text('Não deu para salvar agora.', true);
      return json({ ok: true, mensagem: 'Post atualizado. Ele voltou para revisão: confira e aprove na 1loop.', abrir: `${siteUrl()}/app/conteudos/${id}` });
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC
// ---------------------------------------------------------------------------

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

const INSTRUCTIONS = `Este servidor liga você ao perfil da pessoa na 1loop creators (estratégia e posts de LinkedIn e Instagram).
Comece com get_profile para saber quem ela é. Sempre que ela contar um fato, número, case, história, opinião ou detalhe da oferta/público que ajude nos posts, ofereça salvar com add_context (só o que ela disse). Para reescrever um post, use get_post e, depois de ela aprovar o texto, update_post.`;

async function handleOne(admin: Admin, who: Who, msg: Rpc) {
  const isNotification = msg.id === undefined;
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return isNotification ? null : fail(msg.id, -32600, 'Invalid Request');
  switch (msg.method) {
    case 'initialize': {
      const asked = typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : '';
      return ok(msg.id, {
        protocolVersion: MCP_PROTOCOLS.includes(asked) ? asked : MCP_PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok(msg.id, {});
    case 'tools/list':
      return ok(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments && typeof msg.params.arguments === 'object' ? msg.params.arguments : {}) as Args;
      try {
        const res = await callTool(admin, who, name, args);
        return res ? ok(msg.id, res) : fail(msg.id, -32602, `Ferramenta desconhecida: ${name}`);
      } catch (err) {
        console.error('[mcp]', name, err);
        return ok(msg.id, text('Erro ao executar. Tente de novo em instantes.', true));
      }
    }
    case 'resources/list':
      return ok(msg.id, { resources: [] });
    case 'prompts/list':
      return ok(msg.id, { prompts: [] });
    default:
      return isNotification ? null : fail(msg.id, -32601, `Método não suportado: ${msg.method}`);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, mcp-protocol-version, mcp-session-id',
};

export function mcpOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/** GET: sem stream do servidor (transporte sem estado). */
export function mcpGet() {
  return new Response('Method Not Allowed', { status: 405, headers: { ...CORS, Allow: 'POST' } });
}

export async function mcpPost(req: Request, pathToken?: string) {
  const auth = req.headers.get('authorization') ?? '';
  const token = pathToken || (auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '');
  const admin = createAdminClient();
  const who = token ? await whoIs(admin, token) : null;
  const unauthorized = (m: string) => Response.json(fail(null, -32001, m), { status: 401, headers: CORS });
  if (!who) return unauthorized('Link de conexão inválido ou revogado. Gere um novo em 1loop › Contexto e IAs.');
  const { data: u } = await admin.auth.admin.getUserById(who.userId);
  if (!u?.user) return unauthorized('Conta não encontrada.');
  const access = await accessFor(u.user);
  if (access.mode === 'blocked') return Response.json(fail(null, -32002, 'Sua assinatura da 1loop não está ativa.'), { status: 403, headers: CORS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(fail(null, -32700, 'Parse error'), { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]) as Rpc[];
  const out = (await Promise.all(msgs.slice(0, 20).map((m) => handleOne(admin, who, m && typeof m === 'object' ? m : {})))).filter((x) => x !== null);
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? out : out[0], { headers: CORS });
}
