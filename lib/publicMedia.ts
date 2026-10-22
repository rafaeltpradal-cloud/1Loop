import { createHmac, timingSafeEqual } from 'crypto';
import { siteUrl } from '@/lib/stripe';

// Links públicos e temporários para as redes baixarem as mídias do post (ex.: o Instagram busca a imagem por URL).
// O link carrega o caminho no storage, a validade e uma assinatura; nada mais fica exposto.

const key = () => `1loop-midia:${process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`;
const sign = (payload: string) => createHmac('sha256', key()).update(payload).digest('base64url').slice(0, 32);

export const MIME_BY_EXT: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', mov: 'video/quicktime' };

export function publicMediaUrl(path: string, ttlSeconds = 2 * 60 * 60) {
  const ext = (path.split('.').pop() || 'jpg').toLowerCase();
  const payload = Buffer.from(JSON.stringify({ p: path, e: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  return `${siteUrl()}/api/midia/${payload}~${sign(payload)}.${ext}`;
}

/** Confere o link e devolve o caminho no storage (ou null se for inválido ou vencido). */
export function readPublicMediaToken(file: string): { path: string; ext: string } | null {
  const m = /^([A-Za-z0-9_-]+)~([A-Za-z0-9_-]{32})\.([a-z0-9]{2,4})$/.exec(file);
  if (!m) return null;
  const [, payload, sig, ext] = m;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { p, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p: string; e: number };
    if (typeof p !== 'string' || typeof e !== 'number' || e < Date.now() / 1000) return null;
    return { path: p, ext };
  } catch {
    return null;
  }
}
