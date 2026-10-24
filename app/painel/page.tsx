import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isOwner, ownerData } from '@/lib/owner';
import { OwnerDashboard } from './OwnerDashboard';

export const metadata = { title: 'Painel do dono · 1loop', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

// Painel financeiro só do dono. Não tem link no site nem no app.
export default async function PainelPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/entrar?next=/painel');
  if (!isOwner(user.email)) notFound();
  const data = await ownerData();
  return <OwnerDashboard data={data} />;
}
