import { brl } from '@/lib/plans';

// E-mails do teste de 7 dias: lembrete para criar o primeiro conteúdo e aviso antes da cobrança.
// Mesmo visual do e-mail de boas-vindas (HTML simples com estilos inline).

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function frame(p: { appUrl: string; title: string; paragraphs: string[]; cta: { label: string; href: string }; footer: string }) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F7;font-family:Manrope,Segoe UI,Helvetica,Arial,sans-serif;color:#0E0F12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E3E6EA;border-radius:22px">
<tr><td style="padding:32px 32px 8px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:12px"><img src="${p.appUrl}/email-logo.png" width="40" height="40" alt="" style="display:block;border:0"></td>
<td style="vertical-align:middle;font-size:21px;font-weight:700;letter-spacing:-0.3px"><span style="color:#0E0F12">1loop</span> <span style="color:#7C4DFF">creators</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0">
<h1 style="margin:0;font-size:24px;line-height:1.25;letter-spacing:-0.5px">${esc(p.title)}</h1>
${p.paragraphs.map((t) => `<p style="margin:14px 0 0;font-size:15px;line-height:1.65;color:#2A2D33">${t}</p>`).join('\n')}
</td></tr>
<tr><td style="padding:24px 32px 8px">
<a href="${p.cta.href}" style="display:inline-block;background:#2A2D33;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;border-radius:12px">${esc(p.cta.label)}</a>
</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:13px;line-height:1.6;color:#5E646C">${p.footer}</td></tr>
</table>
<div style="font-size:12px;color:#6E747D;padding-top:16px">1loop creators · Conteúdo com estratégia. Redes com resultado.</div>
</td></tr></table>
</body></html>`;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, '');

/** Dia 3: ainda não gerou nenhum conteúdo. */
export function nudgeEmail(p: { firstName: string; appUrl: string; step: 'entrevista' | 'estrategia' | 'conteudos' }) {
  const next = {
    entrevista: { text: 'Falta a entrevista: são uns 10 minutos, e dela sai a sua estratégia de 30 dias.', label: 'Fazer a entrevista', path: '/app/entrevista' },
    estrategia: { text: 'Sua entrevista está pronta. Falta só gerar a estratégia de 30 dias.', label: 'Gerar a estratégia', path: '/app/estrategia' },
    conteudos: { text: 'Sua estratégia está pronta. Com um clique saem os conteúdos da semana, já com texto e imagem.', label: 'Gerar os conteúdos', path: '/app/conteudos' },
  }[p.step];
  const title = `${p.firstName}, seu primeiro post está a poucos minutos`;
  const paragraphs = [
    'Você começou o teste do 1loop creators, mas ainda não gerou nenhum conteúdo.',
    next.text,
    'Depois é só revisar, ajustar com a IA se quiser e publicar no LinkedIn.',
  ];
  const footer = 'Travou em algum passo? É só responder este e-mail.';
  return {
    subject: title,
    html: frame({ appUrl: p.appUrl, title, paragraphs, cta: { label: next.label, href: `${p.appUrl}${next.path}` }, footer }),
    text: `${title}\n\n${paragraphs.join('\n\n')}\n\n${next.label}: ${p.appUrl}${next.path}\n\n${footer}`,
  };
}

/** Dois dias antes do fim do teste: avisa a data e o valor da cobrança. */
export function chargeReminderEmail(p: { firstName: string; appUrl: string; planName: string; amount: number; trialEnd: Date; posts: number }) {
  const date = p.trialEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' });
  const title = `Seu teste termina em ${date}`;
  const paragraphs = [
    `${esc(p.firstName)}, seu teste do plano <b>${esc(p.planName)}</b> vai até <b>${date}</b>. Nessa data acontece a primeira cobrança, de <b>${brl(p.amount)}</b>, e a assinatura continua mês a mês.`,
    p.posts > 0
      ? `Até agora você gerou ${p.posts} ${p.posts === 1 ? 'conteúdo' : 'conteúdos'}. Continuando, o calendário segue todo mês com estratégia nova.`
      : 'Você ainda não gerou nenhum conteúdo. Dá tempo de testar: entrevista, estratégia e primeiros posts levam uns 15 minutos.',
    `Se não quiser continuar, cancele em Configurações antes de ${date} e nada é cobrado.`,
  ];
  const footer = `Para trocar de plano ou cancelar: <a href="${p.appUrl}/app/configuracoes" style="color:#2A2D33">Configurações</a>. Dúvidas? Responda este e-mail.`;
  return {
    subject: title,
    html: frame({ appUrl: p.appUrl, title, paragraphs, cta: { label: p.posts > 0 ? 'Ver meus conteúdos' : 'Gerar meus conteúdos', href: `${p.appUrl}/app/conteudos` }, footer }),
    text: `${title}\n\n${paragraphs.map(strip).join('\n\n')}\n\nConfigurações: ${p.appUrl}/app/configuracoes`,
  };
}
