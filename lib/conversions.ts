// Conversão "virou cliente pagante", enviada pelo servidor (o cliente não está no site quando o teste acaba).
// - Meta: API de Conversões (evento Purchase), casado com o Pixel pelo e-mail/telefone (com hash), _fbp e _fbc.
// - Google Analytics 4: Measurement Protocol (evento purchase), casado pelo cookie _ga.
// Cada envio só acontece se o segredo correspondente estiver na Vercel:
//   META_CAPI_TOKEN (+ NEXT_PUBLIC_META_PIXEL_ID) e GA4_API_SECRET (+ NEXT_PUBLIC_GA_ID).
// Opcional: META_TEST_EVENT_CODE para ver os eventos em "Testar eventos" no Gerenciador de Eventos.
import { createHash } from 'node:crypto';
import { TRACKING, ORIGIN_COOKIE, parseOrigin } from '@/lib/tracking';
import { siteUrl } from '@/lib/stripe';

const sha = (v: string) => createHash('sha256').update(v.trim().toLowerCase()).digest('hex');

/** Lê da requisição os identificadores de anúncio para guardar na assinatura do Stripe (até a cobrança). */
export function adContextFromRequest(request: Request): Record<string, string> {
  const jar = new Map<string, string>();
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  const out: Record<string, string> = {};
  const fbp = jar.get('_fbp');
  if (fbp) out.trk_fbp = fbp.slice(0, 200);
  let fbc = jar.get('_fbc');
  if (!fbc) {
    const origin = parseOrigin(jar.get(ORIGIN_COOKIE));
    if (origin?.fbclid) fbc = `fb.1.${origin.at ? Date.parse(origin.at) || Date.now() : Date.now()}.${origin.fbclid}`;
  }
  if (fbc) out.trk_fbc = fbc.slice(0, 400);
  // _ga = GA1.1.<id>.<timestamp> → client_id "<id>.<timestamp>"
  const ga = jar.get('_ga')?.split('.').slice(-2).join('.');
  if (ga && /^\d+\.\d+$/.test(ga)) out.trk_ga = ga;
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  if (ip) out.trk_ip = ip.slice(0, 60);
  const ua = request.headers.get('user-agent');
  if (ua) out.trk_ua = ua.slice(0, 400);
  return out;
}

export type PaidConversion = {
  eventId: string; // único por conversão (deduplica reenvios do Stripe)
  userId: string;
  email?: string | null;
  phone?: string | null; // só dígitos, DDD + número
  value: number; // em reais
  plan?: string | null;
  meta?: Record<string, string> | null; // metadata da assinatura (trk_*)
  time?: number; // segundos
};

export async function sendPaidConversion(c: PaidConversion) {
  await Promise.allSettled([sendMeta(c), sendGa(c)]);
}

async function sendMeta(c: PaidConversion) {
  const token = process.env.META_CAPI_TOKEN?.trim();
  const pixel = TRACKING.metaPixel;
  if (!token || !pixel) return;
  const m = c.meta ?? {};
  const phone = (c.phone ?? '').replace(/\D/g, '');
  const userData: Record<string, unknown> = { external_id: [sha(c.userId)] };
  if (c.email) userData.em = [sha(c.email)];
  if (phone) userData.ph = [sha(phone.startsWith('55') ? phone : `55${phone}`)];
  userData.country = [sha('br')];
  if (m.trk_fbp) userData.fbp = m.trk_fbp;
  if (m.trk_fbc) userData.fbc = m.trk_fbc;
  if (m.trk_ip) userData.client_ip_address = m.trk_ip;
  if (m.trk_ua) userData.client_user_agent = m.trk_ua;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: c.time ?? Math.floor(Date.now() / 1000),
        event_id: c.eventId,
        action_source: 'website',
        event_source_url: `${siteUrl()}/bem-vindo`,
        user_data: userData,
        custom_data: { currency: 'BRL', value: c.value, content_name: c.plan ?? 'assinatura', content_type: 'product' },
      },
    ],
  };
  const test = process.env.META_TEST_EVENT_CODE?.trim();
  if (test) body.test_event_code = test;

  const res = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error('[conversão meta]', res.status, (await res.text()).slice(0, 300));
}

async function sendGa(c: PaidConversion) {
  const secret = process.env.GA4_API_SECRET?.trim();
  const ga = TRACKING.ga;
  if (!secret || !ga) return;
  const res = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${ga}&api_secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: c.meta?.trk_ga || `srv.${c.userId}`,
      user_id: c.userId,
      events: [
        {
          name: 'purchase',
          params: {
            transaction_id: c.eventId,
            currency: 'BRL',
            value: c.value,
            items: [{ item_id: c.plan ?? 'assinatura', item_name: `Plano ${c.plan ?? ''}`.trim(), price: c.value, quantity: 1 }],
          },
        },
      ],
    }),
  });
  if (!res.ok) console.error('[conversão ga]', res.status);
}

/** Teste do dono: manda um Purchase de teste para "Eventos de teste" da Meta e um evento de teste ao GA4. */
export async function testConversions(testCode: string | null, userId: string, email?: string | null) {
  const out: Record<string, unknown> = {
    meta_token: !!process.env.META_CAPI_TOKEN?.trim(),
    ga_secret: !!process.env.GA4_API_SECRET?.trim(),
    pixel: TRACKING.metaPixel,
    ga: TRACKING.ga,
  };
  const token = process.env.META_CAPI_TOKEN?.trim();
  if (token && TRACKING.metaPixel) {
    const body: Record<string, unknown> = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `teste_${Date.now()}`,
          action_source: 'website',
          event_source_url: `${siteUrl()}/bem-vindo`,
          user_data: { external_id: [sha(userId)], ...(email ? { em: [sha(email)] } : {}), country: [sha('br')] },
          custom_data: { currency: 'BRL', value: 1, content_name: 'teste' },
        },
      ],
    };
    if (testCode) body.test_event_code = testCode;
    const res = await fetch(`https://graph.facebook.com/v21.0/${TRACKING.metaPixel}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    out.meta = { status: res.status, body: (await res.text()).slice(0, 300) };
  }
  const secret = process.env.GA4_API_SECRET?.trim();
  if (secret && TRACKING.ga) {
    const payload = JSON.stringify({ client_id: `srv.${userId}`, events: [{ name: 'teste_servidor', params: { debug_mode: 1 } }] });
    const dbg = await fetch(`https://www.google-analytics.com/debug/mp/collect?measurement_id=${TRACKING.ga}&api_secret=${encodeURIComponent(secret)}`, { method: 'POST', body: payload });
    const res = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${TRACKING.ga}&api_secret=${encodeURIComponent(secret)}`, { method: 'POST', body: payload });
    out.ga = { status: res.status, validacao: (await dbg.text()).slice(0, 300) };
  }
  return out;
}
