import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';

export const metadata = { title: 'Exclusão de dados · 1loop creators' };

const h2 = { fontSize: 18, marginTop: 10 } as const;

export default async function ExclusaoDeDadosPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const { pedido } = await searchParams;
  const code = pedido && /^[a-f0-9]{6,32}$/.test(pedido) ? pedido : null;
  return (
    <PublicShell>
      <article className="card" style={{ padding: 'clamp(20px, 4vw, 32px)', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.6 }}>
        <h1 style={{ fontSize: 'clamp(24px, 3vw, 30px)' }}>Exclusão de dados</h1>
        {code && (
          <div className="formNote" role="status">
            Pedido <b>{code}</b> recebido: a conexão com o Instagram e o token de acesso já foram apagados.
          </div>
        )}
        <p className="muted">
          Você pode tirar o acesso do 1loop creators às suas redes e pedir a exclusão dos seus dados a qualquer momento. Veja como.
        </p>

        <h2 style={h2}>Desconectar uma rede (Instagram, LinkedIn)</h2>
        <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Entre na sua conta e abra <Link href="/app/redes">Redes</Link>.</li>
          <li>No cartão da rede, toque em <b>Desconectar</b>.</li>
        </ol>
        <p>
          Na hora, apagamos o token de acesso daquela rede e cancelamos as publicações agendadas nela. Você também pode remover o app pelo próprio
          Instagram, em <i>Configurações › Apps e sites</i>; quando isso acontece, a Meta nos avisa e apagamos os dados da conexão do mesmo jeito.
        </p>

        <h2 style={h2}>Excluir a conta e todos os dados</h2>
        <p>
          Mande um e-mail para <a href="mailto:contato@1loopcreators.com.br?subject=Exclus%C3%A3o%20de%20dados">contato@1loopcreators.com.br</a> com o
          assunto <b>Exclusão de dados</b>, a partir do e-mail cadastrado. Em até 15 dias apagamos sua conta, estratégias, conteúdos, fotos, vídeos e
          conexões com redes, e confirmamos por e-mail.
        </p>

        <h2 style={h2}>O que guardamos das redes</h2>
        <p>
          Só o necessário para publicar por você: o identificador e o nome de usuário da conta, o token de acesso (criptografado) e o link dos posts que
          publicamos. Não lemos suas mensagens, seguidores nem posts de outras pessoas.
        </p>
      </article>
    </PublicShell>
  );
}
