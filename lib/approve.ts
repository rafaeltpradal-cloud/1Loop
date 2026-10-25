// Aprovar = agendar. Usado no editor do post e no "Aprovar todos" da semana.
// As imagens são desenhadas no navegador (canvas), enviadas como JPEG e o post entra na fila de publicação
// automática, que publica no LinkedIn/Instagram no horário (o LinkedIn não tem agendamento por API:
// quem segura o post até a hora é o 1loop, como fazem as ferramentas de agendamento).
import { imagesFor, renderImage, type Brand } from '@/lib/postImage';
import { autoBlocker, autoNetworkId, canAutoPublish, type PostAsset, type PostContent } from '@/lib/contentTypes';
import { schedulePost, uploadPostAsset } from '@/app/app/conteudos/publish';

const BR_OFFSET = '-03:00';
const MIN_LEAD = 10 * 60 * 1000;

const isoDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00${BR_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
};

/**
 * Quando o post sai: no dia do calendário, no horário da estratégia.
 * Se esse momento já passou, vai para o próximo dia livre nessa rede (sem dois posts no mesmo dia).
 */
export function slotFor(date: string, time: string, taken: Set<string> = new Set(), now = Date.now()) {
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : '07:30';
  let day = date;
  let when = new Date(`${day}T${hhmm}:00${BR_OFFSET}`);
  if (when.getTime() < now + MIN_LEAD) {
    day = isoDay(new Date(now));
    when = new Date(`${day}T${hhmm}:00${BR_OFFSET}`);
    if (when.getTime() < now + MIN_LEAD) {
      day = addDay(day, 1);
      when = new Date(`${day}T${hhmm}:00${BR_OFFSET}`);
    }
    for (let i = 0; i < 60 && taken.has(day); i++) {
      day = addDay(day, 1);
      when = new Date(`${day}T${hhmm}:00${BR_OFFSET}`);
    }
  }
  return when;
}

/** Desenha as imagens do post e guarda no storage. */
export async function renderAssets(postId: number, formato: string, c: PostContent, brand: Brand, serieNumero: number | undefined, when: Date): Promise<PostAsset[]> {
  const meta = {
    date: isoDay(when),
    time: when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
  };
  const specs = imagesFor(formato, c, brand, serieNumero, meta);
  const out: PostAsset[] = [];
  for (let i = 0; i < specs.length; i++) {
    const canvas = await renderImage(specs[i], c);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Não deu para preparar as imagens.');
    const fd = new FormData();
    fd.append('img', new File([blob], `${i + 1}.jpg`, { type: 'image/jpeg' }));
    fd.append('w', String(canvas.width));
    fd.append('h', String(canvas.height));
    fd.append('n', String(i + 1));
    const r = await uploadPostAsset(postId, fd);
    if (!r.ok || !r.asset) throw new Error(r.ok ? 'Não deu para preparar as imagens.' : r.error);
    out.push(r.asset);
  }
  return out;
}

/** Dá para agendar sozinho? (rede com publicação automática, conectada, e nada faltando no post) */
export function canAutoSchedule(rede: string, formato: string, c: PostContent, connected: Set<string>) {
  const net = autoNetworkId(rede);
  return !!net && connected.has(net) && canAutoPublish(rede, formato) && !autoBlocker(rede, formato, c);
}

export async function approveAndSchedule(p: { id: number; formato: string; content: PostContent }, brand: Brand, serieNumero: number | undefined, when: Date) {
  const assets = await renderAssets(p.id, p.formato, p.content, brand, serieNumero, when);
  const r = await schedulePost(p.id, when.toISOString(), assets);
  if (!r.ok) throw new Error(r.error);
  return when;
}
