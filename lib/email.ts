// Envio de e-mails pela API do Resend (https://resend.com).
// Sem RESEND_API_KEY configurada, nada é enviado e o app segue normalmente.

export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM || '1loop creators <contato@1loopcreators.com.br>';
  if (!key) {
    console.info('[email] RESEND_API_KEY não configurada; e-mail não enviado:', subject);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text, reply_to: process.env.EMAIL_REPLY_TO || undefined }),
  });
  if (!res.ok) {
    console.error('[email] falha ao enviar', res.status, await res.text());
    return false;
  }
  return true;
}
