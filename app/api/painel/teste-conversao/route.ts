import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/owner';
import { testConversions } from '@/lib/conversions';

export const runtime = 'nodejs';

// GET /api/painel/teste-conversao?codigo=TEST123 — só o dono. Confere se a Meta e o Google aceitam os envios do servidor.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isOwner(user.email)) return new NextResponse('Não encontrado', { status: 404 });
  const code = new URL(request.url).searchParams.get('codigo');
  return NextResponse.json(await testConversions(code, user.id, user.email));
}
