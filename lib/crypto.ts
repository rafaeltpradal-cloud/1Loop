import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Criptografa tokens das redes antes de guardar no banco (AES-256-GCM).
// A chave deriva da chave secreta do Supabase, que só existe no servidor.
function key() {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Sem chave para criptografar tokens');
  return createHash('sha256').update(`1loop-tokens:${secret}`).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decrypt(packed: string) {
  const [v, iv, tag, data] = packed.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Token em formato desconhecido');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
