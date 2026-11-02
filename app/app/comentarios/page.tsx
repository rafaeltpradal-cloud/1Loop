import { getPreviewContext as getAppContext } from '@/lib/session';
import { CommentHelper } from './CommentHelper';

export const metadata = { title: 'Comentar em posts · 1loop creators' };

// Social selling: comentar bem nos posts de clientes e prospects gera mais conversa que postar.
export default async function ComentariosPage() {
  const ctx = await getAppContext();
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="pageHead">
        <div className="eyebrow">Comentar em posts</div>
        <h1 className="pageTitle">
          <span className="graphite">Apareça para quem</span> <span className="grad">compra de você.</span>
        </h1>
        <p className="pageSub">Cole o post de um cliente ou prospect. Você recebe 3 comentários na sua voz: um que soma, uma pergunta e um outro ângulo. Comentar bem 3 vezes por dia abre mais conversa que postar.</p>
      </div>
      <CommentHelper preview={ctx.preview} />
    </div>
  );
}
