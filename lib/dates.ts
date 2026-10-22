// Datas no formato 'AAAA-MM-DD', sem fuso horário, para o calendário da estratégia.

export type SpecialDate = { iso: string; nome: string; tipo: 'feriado' | 'data' };

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export const isISODate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(fromISO(v).getTime());

/** Data de hoje (ou de um instante) no horário de Brasília. */
export function isoInBrazil(at: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export function formatShort(iso: string) {
  return fromISO(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function formatLong(iso: string) {
  return fromISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function easter(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// n-ésimo dia da semana do mês (weekday: 0 = domingo).
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

const cache = new Map<number, SpecialDate[]>();

/** Feriados nacionais e datas especiais do comércio no Brasil para um ano. */
export function specialDates(year: number): SpecialDate[] {
  const hit = cache.get(year);
  if (hit) return hit;
  const list: SpecialDate[] = [];
  const fixed = (m: number, d: number, nome: string, tipo: SpecialDate['tipo']) => list.push({ iso: `${year}-${pad(m)}-${pad(d)}`, nome, tipo });
  const rel = (base: Date, days: number, nome: string, tipo: SpecialDate['tipo']) => {
    const x = new Date(base);
    x.setDate(x.getDate() + days);
    list.push({ iso: toISO(x), nome, tipo });
  };

  // Feriados nacionais
  fixed(1, 1, 'Confraternização Universal', 'feriado');
  fixed(4, 21, 'Tiradentes', 'feriado');
  fixed(5, 1, 'Dia do Trabalho', 'feriado');
  fixed(9, 7, 'Independência', 'feriado');
  fixed(10, 12, 'Nossa Senhora Aparecida', 'feriado');
  fixed(11, 2, 'Finados', 'feriado');
  fixed(11, 15, 'Proclamação da República', 'feriado');
  fixed(11, 20, 'Consciência Negra', 'feriado');
  fixed(12, 25, 'Natal', 'feriado');
  const e = easter(year);
  rel(e, -48, 'Carnaval', 'feriado');
  rel(e, -47, 'Carnaval', 'feriado');
  rel(e, -2, 'Sexta-feira Santa', 'feriado');
  rel(e, 60, 'Corpus Christi', 'feriado');

  // Datas especiais (boas para conteúdo e oferta)
  rel(e, -46, 'Quarta-feira de Cinzas', 'data');
  rel(e, 0, 'Páscoa', 'data');
  fixed(3, 8, 'Dia da Mulher', 'data');
  fixed(3, 15, 'Dia do Consumidor', 'data');
  list.push({ iso: toISO(nthWeekday(year, 4, 0, 2)), nome: 'Dia das Mães', tipo: 'data' });
  fixed(6, 12, 'Dia dos Namorados', 'data');
  list.push({ iso: toISO(nthWeekday(year, 7, 0, 2)), nome: 'Dia dos Pais', tipo: 'data' });
  fixed(9, 15, 'Dia do Cliente', 'data');
  fixed(10, 12, 'Dia das Crianças', 'data');
  fixed(10, 15, 'Dia do Professor', 'data');
  fixed(10, 31, 'Halloween', 'data');
  const bf = nthWeekday(year, 10, 4, 4);
  rel(bf, 1, 'Black Friday', 'data');
  rel(bf, 4, 'Cyber Monday', 'data');
  fixed(12, 24, 'Véspera de Natal', 'data');
  fixed(12, 31, 'Réveillon', 'data');

  list.sort((a, b) => a.iso.localeCompare(b.iso) || (a.tipo === 'feriado' ? -1 : 1));
  cache.set(year, list);
  return list;
}

export function specialDatesByDay(years: number[]) {
  const map = new Map<string, SpecialDate[]>();
  for (const y of years) {
    for (const s of specialDates(y)) {
      const arr = map.get(s.iso) ?? [];
      arr.push(s);
      map.set(s.iso, arr);
    }
  }
  return map;
}
