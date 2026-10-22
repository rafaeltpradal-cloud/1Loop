// Publicação automática dos posts agendados (por enquanto, só LinkedIn).
// Roda no servidor com a chave secreta do Supabase; sempre filtra pelo dono do post.

import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';
import { createPost, LinkedInError, uploadDocument, uploadImage, type LinkedInMedia } from '@/lib/linkedin';
import { jpegsToPdf } from '@/lib/pdf';
import { captionWithTags, kindOf, type PostAsset, type PostContent } from '@/lib/contentTypes';

type Admin = ReturnType<typeof createAdminClient>;

export async function getConnection(admin: Admin, userId: string, network: string) {
  const { data } = await admin
    .from('social_connections')
    .select('external_id, name, access_token, expires_at')
    .eq('user_id', userId)
    .eq('network', network)
    .maybeSingle();
  if (!data) return null;
  return {
    externalId: data.external_id as string,
    name: (data.name as string | null) ?? '',
    expiresAt: data.expires_at as string,
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
async function publishLinkedIn(admin: Admin, post: { user_id: string; formato: string; content: PostContent; assets: PostAsset[] | null }) {
  const conn = await getConnection(admin, post.user_id, 'linkedin');
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

function friendly(err: unknown) {
  if (err instanceof LinkedInError) {
    if (err.status === 401) return 'O LinkedIn recusou o acesso. Reconecte em Redes e agende de novo.';
    if (err.status === 403) return 'O LinkedIn não deu permissão para publicar. Reconecte em Redes.';
    if (err.status === 422 || err.status === 400) return `O LinkedIn não aceitou o post (${err.message}).`;
    if (err.status === 429) return 'O LinkedIn pediu para esperar. Tente de novo mais tarde.';
    return `Erro no LinkedIn: ${err.message}`;
  }
  return err instanceof Error ? err.message : 'Erro desconhecido ao publicar.';
}

/** Publica um post agendado. Só segue se conseguir "pegar" o post (evita publicar duas vezes). */
export async function publishOne(admin: Admin, postId: number, userId?: string) {
  let claim = admin
    .from('posts')
    .update({ status: 'publicando', publish_error: null })
    .eq('id', postId)
    .eq('status', 'agendado');
  if (userId) claim = claim.eq('user_id', userId);
  const { data: post } = await claim.select('id, user_id, rede, formato, content, assets').maybeSingle();
  if (!post) return { ok: false as const, error: 'Este post não está agendado.' };

  try {
    if (post.rede !== 'LinkedIn') throw new Error(`A publicação automática no ${post.rede} ainda não está disponível.`);
    const result = await publishLinkedIn(admin, post as never);
    await admin
      .from('posts')
      .update({ status: 'publicado', published_at: new Date().toISOString(), external_url: result.url, publish_error: null, updated_at: new Date().toISOString() })
      .eq('id', post.id);
    return { ok: true as const, url: result.url };
  } catch (err) {
    console.error('[publicar]', post.id, err);
    const message = friendly(err);
    await admin.from('posts').update({ status: 'erro', publish_error: message, updated_at: new Date().toISOString() }).eq('id', post.id);
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
  return results;
}
