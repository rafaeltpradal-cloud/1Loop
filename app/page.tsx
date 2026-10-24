import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LANDING_CSS, LANDING_HTML } from './_landing/content';
import { LandingInteractions } from './_landing/LandingInteractions';
import { landingWithFounders } from '@/lib/founders';

export const metadata: Metadata = {
  title: '1loop creators · Conteúdo com estratégia. LinkedIn com resultado.',
  description:
    'Uma entrevista sobre você, uma estratégia real e posts prontos para o seu LinkedIn, publicados no horário. Teste 7 dias.',
};

export default async function LandingPage() {
  // Quem já está logado vê "Minha conta" no lugar de "Entrar".
  let html = LANDING_HTML;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      html = html
        .replace('href="/entrar" data-auth-link>Entrar</a>', 'href="/app" data-auth-link>Minha conta</a>')
        .replace('href="/entrar" style="color: #5E646C; text-decoration: none" data-auth-link>Entrar</a>', 'href="/app" style="color: #5E646C; text-decoration: none" data-auth-link>Minha conta</a>')
        // No celular, quem já é cliente vê só "Minha conta" no topo.
        .replace('class="btn3d btnSm" href="#planos"', 'class="btn3d btnSm lpHideWhenIn" href="#planos"');
    }
  } catch {
    // Sem sessão: mantém "Entrar".
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: landingWithFounders(html) }} />
      <LandingInteractions />
    </>
  );
}
