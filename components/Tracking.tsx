'use client';

import { Suspense, useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { ORIGIN_COOKIE, ORIGIN_KEYS, TRACKING } from '@/lib/tracking';

type W = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void; dataLayer?: unknown[] };

/** Dispara um evento nas ferramentas ligadas. `meta` usa os nomes padrão da Meta (Lead, StartTrial…). */
export function track(event: { ga: string; meta?: string; params?: Record<string, unknown> }) {
  const w = window as W;
  try {
    w.gtag?.('event', event.ga, event.params ?? {});
    if (event.meta) w.fbq?.('track', event.meta, event.params ?? {});
  } catch {
    // rastreamento nunca pode quebrar a página
  }
}

/** Guarda a origem do primeiro acesso (UTMs e ids de clique) por 90 dias. */
function rememberOrigin() {
  try {
    if (document.cookie.split('; ').some((c) => c.startsWith(`${ORIGIN_COOKIE}=`))) return;
    const q = new URLSearchParams(location.search);
    const origin: Record<string, string> = {};
    for (const k of ORIGIN_KEYS) {
      const v = q.get(k);
      if (v) origin[k] = v.slice(0, 200);
    }
    const external = document.referrer && !document.referrer.startsWith(location.origin) ? document.referrer : '';
    if (!Object.keys(origin).length && !external) return;
    origin.landing = location.pathname;
    if (external) origin.referrer = external.slice(0, 200);
    origin.at = new Date().toISOString();
    document.cookie = `${ORIGIN_COOKIE}=${encodeURIComponent(JSON.stringify(origin))}; path=/; max-age=${90 * 86400}; samesite=lax; secure`;
  } catch {
    // ignora
  }
}

/** De onde a pessoa veio (UTM, clique de anúncio, site externo ou a origem guardada no 1º acesso). */
export function visitSource() {
  try {
    const q = new URLSearchParams(location.search);
    const ext = document.referrer && !document.referrer.startsWith(location.origin) ? new URL(document.referrer).hostname : '';
    let saved: Record<string, string> = {};
    try {
      const c = document.cookie.split('; ').find((x) => x.startsWith(`${ORIGIN_COOKIE}=`));
      if (c) saved = JSON.parse(decodeURIComponent(c.slice(ORIGIN_COOKIE.length + 1)));
    } catch {
      saved = {};
    }
    const savedRef = saved.referrer ? (() => { try { return new URL(saved.referrer).hostname; } catch { return ''; } })() : '';
    return q.get('utm_source') || (q.get('fbclid') ? 'meta' : '') || ext || saved.utm_source || (saved.fbclid ? 'meta' : '') || savedRef || 'direto';
  } catch {
    return 'direto';
  }
}

/** Evento da landing (clique em botão, rolagem) para o funil do /painel. */
export function trackEvent(event: 'cta' | 'scroll50' | 'scroll90' | 'plano', detail?: string) {
  try {
    fetch('/api/evento', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event, detail, path: location.pathname, source: visitSource() }) }).catch(() => {});
  } catch {
    // ignora
  }
}

/** Conta a visita no banco do 1loop (gráfico de visitas do /painel). Só páginas públicas. */
function countVisit(path: string) {
  try {
    if (path.startsWith('/app') || path.startsWith('/painel')) return;
    const q = new URLSearchParams(location.search);
    const ext = document.referrer && !document.referrer.startsWith(location.origin) ? new URL(document.referrer).hostname : '';
    // Páginas seguintes da mesma visita (ex.: /cadastro) herdam a origem guardada no primeiro acesso.
    let saved: Record<string, string> = {};
    try {
      const c = document.cookie.split('; ').find((x) => x.startsWith(`${ORIGIN_COOKIE}=`));
      if (c) saved = JSON.parse(decodeURIComponent(c.slice(ORIGIN_COOKIE.length + 1)));
    } catch {
      saved = {};
    }
    const savedRef = saved.referrer ? (() => { try { return new URL(saved.referrer).hostname; } catch { return ''; } })() : '';
    const source = q.get('utm_source') || (q.get('fbclid') ? 'meta' : '') || ext || saved.utm_source || (saved.fbclid ? 'meta' : '') || savedRef || 'direto';
    const medium = q.get('utm_medium') || (ext ? 'referral' : '') || saved.utm_medium || '';
    fetch('/api/visita', { method: 'POST', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, source, medium }) }).catch(() => {});
  } catch {
    // ignora
  }
}

function PageViews() {
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    rememberOrigin();
    countVisit(path);
    const w = window as W;
    // A primeira visualização já vai no carregamento dos scripts; aqui contam as trocas de página.
    if (!(w as unknown as { __trkFirst?: boolean }).__trkFirst) {
      (w as unknown as { __trkFirst?: boolean }).__trkFirst = true;
      return;
    }
    w.gtag?.('event', 'page_view', { page_path: path });
    w.fbq?.('track', 'PageView');
  }, [path, search]);
  return null;
}

export function Tracking() {
  const { ga, metaPixel, metaPixelLegacy, linkedin } = TRACKING;
  return (
    <>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}
          </Script>
        </>
      )}
      {metaPixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');${metaPixelLegacy && metaPixelLegacy !== metaPixel ? `fbq('init','${metaPixelLegacy}');` : ''}fbq('track','PageView');`}
        </Script>
      )}
      {linkedin && (
        <Script id="li-insight" strategy="afterInteractive">
          {`window._linkedin_partner_id='${linkedin}';window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push('${linkedin}');(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName('script')[0];var b=document.createElement('script');b.type='text/javascript';b.async=true;b.src='https://snap.licdn.com/li.lms-analytics/insight.min.js';s.parentNode.insertBefore(b,s)})(window.lintrk);`}
        </Script>
      )}
    </>
  );
}

/** Dispara um evento uma vez quando a página abre (ex.: assinatura iniciada). */
export function TrackOnce({ ga, meta, params, id }: { ga: string; meta?: string; params?: Record<string, unknown>; id: string }) {
  useEffect(() => {
    const key = `trk:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // sem sessionStorage: dispara assim mesmo
    }
    // Espera os scripts carregarem.
    const t = setTimeout(() => track({ ga, meta, params }), 1200);
    return () => clearTimeout(t);
  }, [ga, meta, params, id]);
  return null;
}
