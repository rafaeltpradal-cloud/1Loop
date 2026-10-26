'use client';

import { useEffect } from 'react';
import { track, trackEvent } from '@/components/Tracking';

// Liga o seletor "Sem rosto / Com rosto" da landing.
export function LandingInteractions() {
  useEffect(() => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-face-btn]'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('[data-face]'));
    const handlers = buttons.map((btn) => {
      const onClick = () => {
        const pick = btn.dataset.faceBtn;
        buttons.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        panels.forEach((p) => {
          p.hidden = p.dataset.face !== pick;
        });
      };
      btn.addEventListener('click', onClick);
      return () => btn.removeEventListener('click', onClick);
    });
    // Funil da página: clique nos botões de cadastro/planos e quanto a pessoa rolou.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a) return;
      const cta = a.dataset.cta;
      const href = a.getAttribute('href') ?? '';
      if (cta) {
        trackEvent('cta', cta);
        track({ ga: 'cta_click', meta: 'ViewContent', params: { cta } });
      } else if (href.startsWith('/cadastro')) trackEvent('plano', new URLSearchParams(href.split('?')[1] ?? '').get('plano') ?? 'cadastro');
      else if (href === '#planos') trackEvent('cta', 'ver-planos');
    };
    document.addEventListener('click', onClick);
    const seen = new Set<string>();
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = window.scrollY / max;
      if (pct >= 0.5 && !seen.has('50')) {
        seen.add('50');
        trackEvent('scroll50');
      }
      if (pct >= 0.9 && !seen.has('90')) {
        seen.add('90');
        trackEvent('scroll90');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      handlers.forEach((off) => off());
      document.removeEventListener('click', onClick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return null;
}
