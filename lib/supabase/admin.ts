import { createClient } from '@supabase/supabase-js';

// Cliente com a chave secreta (service role). Ignora o RLS.
// Use SOMENTE no servidor, em rotas que não dependem do usuário logado (ex.: webhook do Stripe).
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
