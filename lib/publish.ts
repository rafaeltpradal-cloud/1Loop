// Publicação automática dos posts agendados (LinkedIn e Instagram).
// Roda no servidor com a chave secreta do Supabase; sempre filtra pelo dono do post.

import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { createPost, LinkedInError, uploadDocument, uploadImage, type LinkedInMedia } from '@/lib/linkedin';
import { jpegsToPdf } from '@/lib/pdf';
import { encrypt } from '@/lib/crypto';
import * as ig from '@/lib/instagram';
import { sendEmail } from '@/lib/email';
import { siteUrl } from '@/lib/stripe';
import { publicMediaUrl } from '@/lib/publicMedia';
import { autoBlocker, captionWithTags, kindOf, type PostAsset, type PostContent } from '@/lib/contentTypes';

type Admin = ReturnType<typeof createAdminClient>;

/** Conexão de uma rede em uma marca. */
export async function getConnection(admin: Admin, brandId: number, network: string) {
  const { data } = await admin
    .from('social_connections')
    .select('external_id, name, access_token, expires_at, meta, scopes')
    .eq('brand_id', brandId)
    .eq('network', network)
    .maybeSingle();
  if (!data) return null;
  return {
    externalId: data.external_id as string,
    name: (data.name as string | null) ?? '',
    expiresAt: data.expires_at as string,
    meta: (data.meta as Record<string, unknown> | null) ?? {},
    scopes: (data.scopes as string | null) ?? '',
    token: () => decrypt(data.access_token as string),
  };
}

function postText(formato: string, c: PostContent) {
  if (kindOf(formato) === 'thread' && c.partes?.length) return c.partes.join('\n\n');
  return captionWithTags(c);
}

async function download(admin: Admin, path: string) {
  const { data, error } = await admin.storage.from('media').download(path);
  if (error || !data) throw new Error('Imagem do post não encontrada. Reagende para gerar de novo.');
  return new Uint8Array(await data.arrayBuffer());
}

/** Publica um post que está como "publicando". Devolve o link do post publicado. */
async function publishLinkedIn(admin: Admin, post: PostForPublish) {
  const conn = await getConnection(admin, post.brand_id, 'linkedin');
  if (!conn) throw new Error('O LinkedIn não está conectado. Conecte em Redes e agende de novo.');
  if (new Date(conn.expiresAt).getTime() < Date.now()) throw new Error('A conexão com o LinkedIn expirou. Reconecte em Redes e agende de novo.');
  const token = conn.token();
  const author = `urn:li:person:${conn.externalId}`;

  const assets = post.assets ?? [];
  let media: LinkedInMedia = null;
  if (assets.length) {
    const files = await Promise.all(assets.map((a) => download(admin, a.path)));
    if (kindOf(post.formato) === 'carrossel' && files.length > 1) {
      const pdf = jpegsToPdf(files.map((bytes, i) => ({ bytes, w: assets[i].w, h: assets[i].h })));
      media = { kind: 'document', urn: await uploadDocument(token, author, pdf), title: post.content.gancho || 'Carrossel' };
    } else {
      const urns: string[] = [];
      for (const f of files.slice(0, 9)) urns.push(await uploadImage(token, author, f));
      media = { kind: 'image', urns };
    }
  }
  return createPost(token, author, postText(post.formato, post.content), media);
}

type PostForPublish = {
  id: number;
  user_id: string;
  brand_id: number;
  rede: string;
  formato: string;
  content: PostContent;
  assets: PostAsset[] | null;
  platform_ref: string | null;
};

/** Resultado de uma tentativa: publicado, ou "continua depois" (vídeo ainda processando no Instagram). */
type Outcome = { done: true; url: string } | { done: false; ref: string };

async function publishInstagram(admin: Admin, post: PostForPublish): Promise<Outcome> {
  const conn = await getConnection(admin, post.brand_id, 'instagram');
  if (!conn) throw new Error('O Instagram não está conectado. Conecte em Redes e agende de novo.');
  if (new Date(conn.expiresAt).getTime() < Date.now()) throw new Error('A conexão com o Instagram expirou. Reconecte em Redes e agende de novo.');
  const blocker = autoBlocker(post.rede, post.formato, post.content);
  if (blocker) throw new Error(blocker);
  const token = conn.token();
  const igId = conn.externalId;
  const caption = captionWithTags(post.content).slice(0, 2200);
  const assets = post.assets ?? [];
  const url = (a: PostAsset) => publicMediaUrl(a.path);
  const kind = kindOf(post.formato);

  // Reels: o vídeo pode levar minutos para processar. Guardamos o contêiner e continuamos na próxima rodada.
  if (kind === 'video') {
    let container = post.platform_ref;
    if (!container) {
      const { data: video } = await admin.from('media').select('path').eq('id', post.content.video!).eq('user_id', post.user_id).eq('kind', 'video').maybeSingle();
      if (!video) throw new Error('O vídeo do reels não foi encontrado na sua biblioteca. Escolha de novo.');
      container = await ig.createContainer(token, igId, { kind: 'reel', videoUrl: publicMediaUrl(video.path as string, 6 * 3600), caption, coverUrl: assets[0] ? publicMediaUrl(assets[0].path, 6 * 3600) : undefined });
    }
    if (!(await ig.waitReady(token, container, 40000))) return { done: false, ref: container };
    const mediaId = await ig.publishContainer(token, igId, container);
    return { done: true, url: (await ig.permalink(token, mediaId)) ?? `https://www.instagram.com/${conn.name}/` };
  }

  if (!assets.length) throw new Error('As imagens do post não foram encontradas. Reagende para gerar de novo.');

  if (kind === 'stories') {
    if (conn.meta.account_type && conn.meta.account_type !== 'BUSINESS') throw new Error('Stories por API só funcionam em conta Comercial do Instagram. Mude o tipo de conta no app do Instagram.');
    for (const a of assets.slice(0, 10)) {
      const c = await ig.createContainer(token, igId, { kind: 'story', url: url(a) });
      await ig.waitReady(token, c, 20000);
      await ig.publishContainer(token, igId, c);
    }
    return { done: true, url: `https://www.instagram.com/stories/${conn.name}/` };
  }

  let container: string;
  if (assets.length > 1) {
    const children: string[] = [];
    for (const a of assets.slice(0, 10)) children.push(await ig.createContainer(token, igId, { kind: 'image', url: url(a), carouselItem: true }));
    container = await ig.createContainer(token, igId, { kind: 'carousel', children, caption });
  } else {
    container = await ig.createContainer(token, igId, { kind: 'image', url: url(assets[0]), caption });
  }
  await ig.waitReady(token, container, 30000);
  const mediaId = await ig.publishContainer(token, igId, container);
  return { done: true, url: (await ig.permalink(token, mediaId)) ?? `https://www.instagram.com/${conn.name}/` };
}

function friendly(err: unknown) {
  if (err instanceof ig.InstagramError) {
    if (err.status === 401 || err.code === 190) return 'O Instagram recusou o acesso. Reconecte em Redes e agende de novo.';
    if (err.code === 9 || err.code === 4) return 'O Instagram atingiu o limite de publicações de hoje. Tente amanhã.';
    return `O Instagram não aceitou o post: ${err.message}`;
  }
  if (err instanceof LinkedInError) {
    if (err.status === 401) return 'O LinkedIn recusou o acesso. Reconecte em Redes e agende de novo.';
    if (err.status === 403) return 'O LinkedIn não deu permissão para publicar. Reconecte em Redes.';
    if (err.status === 422 || err.status === 400) return `O LinkedIn não aceitou o post (${err.message}).`;
    if (err.status === 429) return 'O LinkedIn pediu para esperar. Tente de novo mais tarde.';
    return `Erro no LinkedIn: ${err.message}`;
  }
  return err instanceof Error ? err.message : 'Erro desconhecido ao publicar.';
}

/** Erro de acesso (conexão vencida ou autorização revogada): o post espera a reconexão em vez de se perder. */
function isAuthError(err: unknown) {
  if (err instanceof LinkedInError) return err.status === 401 || err.status === 403;
  if (err instanceof ig.InstagramError) return err.status === 401 || err.code === 190;
  return err instanceof Error && /não está conectado|expirou/.test(err.message);
}

/** Depois de reconectar: os posts que travaram por falta de acesso voltam para a fila (saem em seguida, se já passou da hora). */
export async function requeueAfterReconnect(admin: Admin, brandId: number, rede: 'LinkedIn' | 'Instagram') {
  const { data } = await admin.from('posts').select('id, scheduled_at').eq('brand_id', brandId).eq('rede', rede).eq('status', 'erro').eq('platform_ref', 'auth');
  const soon = Date.now() + 2 * 60 * 1000;
  for (const p of data ?? []) {
    const at = p.scheduled_at ? Math.max(new Date(p.scheduled_at as string).getTime(), soon) : soon;
    await admin.from('posts').update({ status: 'agendado', scheduled_at: new Date(at).toISOString(), publish_error: null, platform_ref: null }).eq('id', p.id);
  }
  return data?.length ?? 0;
}

/** Avisa por e-mail (no máximo 1 vez a cada 12 h por marca) que é preciso reconectar a rede. */
async function warnReconnect(admin: Admin, post: PostForPublish) {
  try {
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { count } = await admin.from('posts').select('id', { count: 'exact', head: true }).eq('brand_id', post.brand_id).eq('platform_ref', 'auth').gte('updated_at', since).neq('id', post.id);
    if (count) return;
    const { data } = await admin.auth.admin.getUserById(post.user_id);
    const email = data?.user?.email;
    if (!email) return;
    const url = `${siteUrl()}/app/redes`;
    const title = `Seu post não saiu: reconecte o ${post.rede}`;
    const body = `O ${post.rede} pediu uma nova autorização e o post agendado ficou esperando. Reconecte em Redes (leva 10 segundos): os posts que ficaram para trás saem logo em seguida.`;
    await sendEmail({
      to: email,
      subject: title,
      html: `<div style="font-family:Segoe UI,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0E0F12"><h2 style="margin:0 0 10px">${title}</h2><p style="font-size:15px;line-height:1.6;color:#2A2D33">${body}</p><p><a href="${url}" style="display:inline-block;background:#2A2D33;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">Reconectar o ${post.rede}</a></p></div>`,
      text: `${title}\n\n${body}\n\n${url}`,
    });
  } catch (err) {
    console.error('[aviso reconectar]', err);
  }
}

/** Publica um post agendado. Só segue se conseguir "pegar" o post (evita publicar duas vezes). */
export async function publishOne(admin: Admin, postId: number, userId?: string) {
  let claim = admin
    .from('posts')
    .update({ status: 'publicando', publish_error: null })
    .eq('id', postId)
    .eq('status', 'agendado');
  if (userId) claim = claim.eq('user_id', userId);
  const { data: row } = await claim.select('id, user_id, brand_id, rede, formato, content, assets, platform_ref').maybeSingle();
  if (!row) return { ok: false as const, error: 'Este post não está agendado.' };
  const post = row as unknown as PostForPublish;

  try {
    let outcome: Outcome;
    if (post.rede === 'LinkedIn') outcome = { done: true, url: (await publishLinkedIn(admin, post)).url };
    else if (post.rede === 'Instagram') outcome = await publishInstagram(admin, post);
    else throw new Error(`A publicação automática no ${post.rede} ainda não está disponível.`);

    if (!outcome.done) {
      // Volta para a fila e tenta de novo em 2 minutos, reaproveitando o vídeo já enviado.
      await admin
        .from('posts')
        .update({ status: 'agendado', platform_ref: outcome.ref, scheduled_at: new Date(Date.now() + 2 * 60 * 1000).toISOString() })
        .eq('id', post.id);
      return { ok: true as const, url: undefined, pending: true };
    }
    await admin
      .from('posts')
      .update({ status: 'publicado', published_at: new Date().toISOString(), external_url: outcome.url, publish_error: null, platform_ref: null, updated_at: new Date().toISOString() })
      .eq('id', post.id);
    return { ok: true as const, url: outcome.url };
  } catch (err) {
    console.error('[publicar]', post.id, err);
    const auth = isAuthError(err);
    const message = auth ? `O ${post.rede} pediu uma nova autorização. Reconecte em Redes: o post sai logo em seguida, sem precisar agendar de novo.` : friendly(err);
    await admin.from('posts').update({ status: 'erro', publish_error: message, platform_ref: auth ? 'auth' : null, updated_at: new Date().toISOString() }).eq('id', post.id);
    if (auth) await warnReconnect(admin, post);
    return { ok: false as const, error: message };
  }
}

/** Publica tudo que já venceu. Chamado pelo agendador a cada 5 minutos. */
export async function publishDue() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('posts')
    .select('id')
    .eq('status', 'agendado')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(8);
  const results: Array<{ id: number; ok: boolean; url?: string; error?: string }> = [];
  for (const row of data ?? []) results.push({ id: row.id as number, ...(await publishOne(admin, row.id as number)) });
  await refreshInstagramTokens(admin).catch((err) => console.error('[instagram refresh]', err));
  return results;
}

/** Renova os tokens do Instagram que vencem em menos de 20 dias (o Instagram só deixa renovar depois de 24 h). */
export async function refreshInstagramTokens(admin: Admin) {
  const soon = new Date(Date.now() + 20 * 86400000).toISOString();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const { data } = await admin
    .from('social_connections')
    .select('brand_id, access_token, expires_at')
    .eq('network', 'instagram')
    .lt('expires_at', soon)
    .gt('expires_at', new Date().toISOString())
    .lt('updated_at', dayAgo)
    .limit(20);
  for (const c of data ?? []) {
    try {
      const r = await ig.refreshToken(decrypt(c.access_token as string));
      await admin
        .from('social_connections')
        .update({ access_token: encrypt(r.access_token), expires_at: new Date(Date.now() + (r.expires_in || 5184000) * 1000).toISOString(), updated_at: new Date().toISOString() })
        .eq('brand_id', c.brand_id)
        .eq('network', 'instagram');
    } catch (err) {
      console.error('[instagram refresh]', c.brand_id, err);
    }
  }
}
