import { brl } from '@/lib/plans';

// E-mail de boas-vindas / confirmação de assinatura. HTML simples, com estilos inline (compatível com Gmail e Outlook).

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function welcomeEmail(p: { firstName: string; planName: string; rhythm: string; amount: number; trialEnd: Date | null; appUrl: string }) {
  const date = p.trialEnd ? p.trialEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }) : null;
  const subject = `Seu teste do 1loop creators ${p.planName} começou`;
  const charge = date
    ? `Seus 7 dias de teste vão até <b>${date}</b>. A primeira cobrança, de <b>${brl(p.amount)}</b>, acontece só nessa data. Se cancelar antes, você não paga nada.`
    : `Sua assinatura está ativa: <b>${brl(p.amount)}/mês</b>.`;
  const chargeText = date
    ? `Seus 7 dias de teste vão até ${date}. A primeira cobrança, de ${brl(p.amount)}, acontece só nessa data. Se cancelar antes, você não paga nada.`
    : `Sua assinatura está ativa: ${brl(p.amount)}/mês.`;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F7;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;color:#0E0F12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E3E6EA;border-radius:22px">
<tr><td style="padding:32px 32px 8px">
<div style="font-size:20px;font-weight:700;letter-spacing:-0.3px"><span style="color:#0E0F12">1loop</span> <span style="color:#7C4DFF">creators</span></div>
</td></tr>
<tr><td style="padding:16px 32px 0">
<h1 style="margin:0;font-size:26px;line-height:1.2;letter-spacing:-0.6px">Bem-vindo, ${esc(p.firstName)}. Seu teste começou.</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#2A2D33">Sua assinatura do plano <b>${esc(p.planName)}</b> (${esc(p.rhythm.toLowerCase())}) está confirmada.</p>
<p style="margin:12px 0 0;font-size:15px;line-height:1.65;color:#2A2D33">${charge}</p>
</td></tr>
<tr><td style="padding:24px 32px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #EEF0F2;border-radius:16px">
<tr><td style="padding:18px 20px;font-size:14px;line-height:1.7;color:#2A2D33">
<div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#5E646C;margin-bottom:6px">Próximos passos</div>
1. Faça a entrevista (uns 10 minutos)<br>2. Veja sua estratégia de 30 dias<br>3. Cadastre suas redes
</td></tr></table>
</td></tr>
<tr><td style="padding:24px 32px 8px">
<a href="${p.appUrl}/app/entrevista" style="display:inline-block;background:#5E646C;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:1.6px;text-transform:uppercase;padding:16px 28px;border-radius:999px">Começar a entrevista</a>
</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:13px;line-height:1.6;color:#5E646C">
Para trocar de plano, atualizar o cartão ou cancelar, acesse <a href="${p.appUrl}/app/configuracoes" style="color:#2A2D33">Configurações</a>. Dúvidas? É só responder este e-mail.
</td></tr>
</table>
<div style="font-size:12px;color:#6E747D;padding-top:16px">1loop creators · Conteúdo com estratégia. Redes com resultado.</div>
</td></tr></table>
</body></html>`;

  const text = `Bem-vindo, ${p.firstName}. Seu teste começou.

Sua assinatura do plano ${p.planName} (${p.rhythm.toLowerCase()}) está confirmada.
${chargeText}

Próximos passos:
1. Faça a entrevista (uns 10 minutos)
2. Veja sua estratégia de 30 dias
3. Cadastre suas redes

Começar: ${p.appUrl}/app/entrevista

Para trocar de plano, atualizar o cartão ou cancelar: ${p.appUrl}/app/configuracoes
Dúvidas? É só responder este e-mail.`;

  return { subject, html, text };
}
