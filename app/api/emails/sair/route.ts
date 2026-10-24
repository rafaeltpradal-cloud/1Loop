import { NextResponse } from 'next/server';
import { optOut } from '@/lib/recovery';

export const runtime = 'nodejs';

function page(title: string, text: string) {
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · 1loop creators</title></head>
<body style="margin:0;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;background:#F4F5F7;color:#0E0F12;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
<div style="max-width:440px;background:#fff;border:1px solid #E3E6EA;border-radius:22px;padding:32px"><h1 style="margin:0 0 10px;font-size:22px">${title}</h1><p style="margin:0;font-size:15px;line-height:1.6;color:#2A2D33">${text}</p>
<p style="margin:18px 0 0"><a href="/" style="color:#7C4DFF;font-weight:700">Voltar ao site</a></p></div></body></html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

// Link "não quero mais receber" dos e-mails de lembrete. POST = descadastro em 1 clique (List-Unsubscribe).
async function handle(req: Request) {
  const url = new URL(req.url);
  const ok = await optOut(url.searchParams.get('u') ?? '', url.searchParams.get('t') ?? '').catch(() => false);
  return ok
    ? page('Pronto, você saiu da lista.', 'Não vamos mais mandar lembretes. E-mails sobre a sua conta (como recibos e avisos de cobrança) continuam chegando.')
    : page('Link inválido', 'Não conseguimos confirmar este link. Responda qualquer e-mail nosso pedindo para sair que a gente tira você da lista.');
}

export const GET = handle;
export const POST = handle;
