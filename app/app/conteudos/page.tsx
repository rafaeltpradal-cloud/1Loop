import Link from 'next/link';

export const metadata = { title: 'Conteúdos · 1loop creators' };

export default function ConteudosPage() {
  return (
    <div className="card" style={{ padding: 32, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="eyebrow">Em breve</div>
      <h1 style={{ fontSize: 30, letterSpacing: '-0.8px' }}><span className="graphite">Seus lotes de conteúdo vão aparecer aqui.</span></h1>
      <p className="muted" style={{ fontSize: 16, lineHeight: 1.6 }}>Na próxima etapa, a ferramenta transforma sua estratégia em conteúdos prontos (texto, imagem e roteiro) para você aprovar e publicar.</p>
      <div><Link className="btnGhost btnSm" href="/app/estrategia">Ver minha estratégia</Link></div>
    </div>
  );
}
