import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { LANDING_CSS, LANDING_HTML } from './_landing/content';
import { LandingInteractions } from './_landing/LandingInteractions';

export const metadata: Metadata = {
  title: '1loop creators · Conteúdo com estratégia. Redes com resultado.',
  description:
    'Uma entrevista sobre você, uma estratégia real e conteúdos prontos para cada rede, cada um com um objetivo claro. Teste 7 dias.',
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
        .replace('href="/entrar" style="color: #5E646C; text-decoration: none" data-auth-link>Entrar</a>', 'href="/app" style="color: #5E646C; text-decoration: none" data-auth-link>Minha conta</a>');
    }
  } catch {
    // Sem sessão: mantém "Entrar".
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: html }} />
      <LandingInteractions />
    </>
  );
}
