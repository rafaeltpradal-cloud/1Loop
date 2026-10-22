import { redirect } from 'next/navigation';

// A landing page fica no site institucional. O app começa pela escolha do plano.
export default function Home() {
  redirect('/planos');
}
