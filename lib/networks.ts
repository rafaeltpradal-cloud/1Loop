// Redes atendidas. Os nomes batem com as opções da entrevista.
export type NetworkId = 'instagram' | 'linkedin' | 'tiktok' | 'youtube' | 'facebook' | 'threads';

export type Network = { id: NetworkId; name: string; short: string; color: string; placeholder: string; prefix: string };

export const NETWORKS: Network[] = [
  { id: 'instagram', name: 'Instagram', short: 'IG', color: '#E1306C', placeholder: '@seuperfil', prefix: '@' },
  { id: 'linkedin', name: 'LinkedIn', short: 'in', color: '#0A66C2', placeholder: 'linkedin.com/in/seu-nome', prefix: 'linkedin.com/in/' },
  { id: 'tiktok', name: 'TikTok', short: 'TT', color: '#111214', placeholder: '@seuperfil', prefix: '@' },
  { id: 'youtube', name: 'YouTube Shorts', short: 'YT', color: '#FF0033', placeholder: '@seucanal', prefix: '@' },
  { id: 'facebook', name: 'Facebook', short: 'FB', color: '#1877F2', placeholder: 'facebook.com/suapagina', prefix: 'facebook.com/' },
  { id: 'threads', name: 'Threads', short: '@', color: '#111214', placeholder: '@seuperfil', prefix: '@' },
];

export const isNetworkId = (v: unknown): v is NetworkId => NETWORKS.some((n) => n.id === v);

export function networkByName(name: string) {
  return NETWORKS.find((n) => n.name === name);
}

// Aceita @perfil, perfil ou o link do perfil. Guarda só o identificador.
export function cleanHandle(raw: string) {
  let v = raw.trim();
  v = v.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  v = v.replace(/^(instagram\.com|tiktok\.com|youtube\.com|threads\.net|threads\.com|facebook\.com|fb\.com|linkedin\.com)\/?/i, '');
  v = v.replace(/^(in|company)\//i, '');
  v = v.split(/[?#]/)[0].replace(/\/+$/, '');
  v = v.replace(/^@/, '');
  return v.replace(/[^\p{L}\p{N}._\-]/gu, '').slice(0, 80);
}
