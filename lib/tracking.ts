// Rastreamento de campanhas: Google Analytics 4, Pixel da Meta e Insight Tag do LinkedIn.
// Cada um só liga quando o ID correspondente está configurado na Vercel.
// Os IDs não são segredo (aparecem no navegador de qualquer visitante).

// Aceita tanto o ID puro quanto o código de instalação colado inteiro: tira só o ID de dentro.
const pick = (raw: string | undefined, re: RegExp) => (raw ?? '').match(re)?.[0] ?? '';
const pixelId = (raw: string | undefined) => (raw ?? '').match(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/)?.[1] ?? pick(raw, /\d{6,20}/);

export const TRACKING = {
  ga: pick(process.env.NEXT_PUBLIC_GA_ID, /G-[A-Z0-9]{4,16}/),
  metaPixel: pixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID),
  linkedin: pick(process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID, /\d{4,12}/),
};

export const ORIGIN_COOKIE = 'origem';

/** Origem do visitante (primeiro toque): UTMs, ids de clique, página de entrada e de onde veio. */
export type Origin = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  li_fat_id?: string;
  landing?: string;
  referrer?: string;
  at?: string;
};

export const ORIGIN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'li_fat_id'] as const;

/** Lê o cookie de origem com segurança (texto curto, só as chaves conhecidas). */
export function parseOrigin(raw: string | undefined | null): Origin | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const out: Origin = {};
    for (const k of [...ORIGIN_KEYS, 'landing', 'referrer', 'at'] as const) {
      const v = data[k];
      if (typeof v === 'string' && v) out[k] = v.slice(0, 300);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}
