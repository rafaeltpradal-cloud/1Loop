import { createBrowserClient } from '@supabase/ssr';

// Cliente do Supabase no navegador (usa a sessão de quem está logado). Usado para enviar vídeos direto
// para a pasta da pessoa, sem passar pelo servidor (vídeos são grandes demais para isso).
export function createBrowserSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
