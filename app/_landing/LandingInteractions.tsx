'use client';

import { useEffect } from 'react';

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
    return () => handlers.forEach((off) => off());
  }, []);
  return null;
}
