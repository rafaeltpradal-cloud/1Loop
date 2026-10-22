import { redirect } from 'next/navigation';

// "Conta e plano" agora faz parte de Configurações.
export default function ContaPage() {
  redirect('/app/configuracoes');
}
