// "Formato real": imagens que parecem feitas por gente, não por IA. Em vez do cartão com frase e degradê,
// a IA escolhe para cada post o formato que melhor conta aquela ideia (print de post, conversa, lista,
// comparativo, gráfico, anotação à mão; nos carrosséis, páginas de caderno) e preenche os dados.
// Sem dependências de servidor: usado também no navegador (lib/arteImage.ts desenha).

export type ArteTipo = 'frase' | 'post' | 'conversa' | 'lista' | 'comparativo' | 'grafico' | 'anotacao' | 'documento';

export const ARTE_TIPOS: { id: ArteTipo; nome: string; para: 'imagem' | 'carrossel' | 'ambos' }[] = [
  { id: 'post', nome: 'Print de post', para: 'imagem' },
  { id: 'conversa', nome: 'Conversa', para: 'imagem' },
  { id: 'lista', nome: 'Checklist', para: 'imagem' },
  { id: 'comparativo', nome: 'Comparativo', para: 'imagem' },
  { id: 'grafico', nome: 'Gráfico', para: 'imagem' },
  { id: 'anotacao', nome: 'Anotação', para: 'imagem' },
  { id: 'documento', nome: 'Caderno', para: 'carrossel' },
];

export const arteTiposFor = (kind: string) => ARTE_TIPOS.filter((t) => t.para === 'ambos' || t.para === (kind === 'carrossel' ? 'carrossel' : 'imagem'));

export type Arte = {
  tipo: ArteTipo;
  /** Título curto (lista, comparativo, gráfico). */
  titulo?: string;
  /** Texto principal (print de post, anotação). */
  texto?: string;
  /** Trecho do texto a sublinhar (anotação). */
  destaque?: string;
  /** Nome genérico do contato na conversa ("Cliente", "Gerente"). Nunca nome de pessoa real. */
  contato?: string;
  mensagens?: { de: 'eu' | 'outro'; texto: string }[];
  itens?: { texto: string; feito: boolean }[];
  colunas?: [string, string];
  linhas?: [string, string][];
  barras?: { rotulo: string; valor: number }[];
  /** Mostra os números nas barras (só quando vieram da própria pessoa). */
  valores?: boolean;
  unidade?: string;
  /** Linha pequena de rodapé (fonte do dado, observação). */
  nota?: string;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valida o que veio da IA (ou da tela). Devolve null se não der para desenhar. */
export function sanitizeArte(raw: unknown, kind?: string): Arte | null {
  if (!isObj(raw)) return null;
  const tipo = ARTE_TIPOS.some((t) => t.id === raw.tipo) || raw.tipo === 'frase' ? (raw.tipo as ArteTipo) : null;
  if (!tipo) return null;
  if (kind === 'carrossel' && tipo !== 'documento' && tipo !== 'frase') return null;
  if (kind && kind !== 'carrossel' && tipo === 'documento') return null;
  const out: Arte = { tipo };
  const titulo = s(raw.titulo, 90);
  const texto = s(raw.texto, 420);
  const nota = s(raw.nota, 120);
  if (titulo) out.titulo = titulo;
  if (texto) out.texto = texto;
  if (nota) out.nota = nota;
  switch (tipo) {
    case 'post':
      if (!texto) return null;
      break;
    case 'anotacao': {
      if (!texto) return null;
      const d = s(raw.destaque, 80);
      if (d && texto.includes(d)) out.destaque = d;
      break;
    }
    case 'conversa': {
      const msgs = (Array.isArray(raw.mensagens) ? raw.mensagens : [])
        .filter(isObj)
        .map((m) => ({ de: m.de === 'eu' ? ('eu' as const) : ('outro' as const), texto: s(m.texto, 220) }))
        .filter((m) => m.texto)
        .slice(0, 7);
      if (msgs.length < 2) return null;
      out.mensagens = msgs;
      out.contato = s(raw.contato, 28) || 'Cliente';
      break;
    }
    case 'lista': {
      const itens = (Array.isArray(raw.itens) ? raw.itens : [])
        .map((i) => (typeof i === 'string' ? { texto: s(i, 90), feito: false } : isObj(i) ? { texto: s(i.texto, 90), feito: i.feito === true } : null))
        .filter((i): i is { texto: string; feito: boolean } => !!i && !!i.texto)
        .slice(0, 7);
      if (itens.length < 3) return null;
      out.itens = itens;
      break;
    }
    case 'comparativo': {
      const cols = Array.isArray(raw.colunas) ? raw.colunas.map((c) => s(c, 24)) : [];
      const linhas = (Array.isArray(raw.linhas) ? raw.linhas : [])
        .map((l) => (Array.isArray(l) ? ([s(l[0], 70), s(l[1], 70)] as [string, string]) : isObj(l) ? ([s(l.esquerda ?? l[0], 70), s(l.direita ?? l[1], 70)] as [string, string]) : null))
        .filter((l): l is [string, string] => !!l && !!l[0] && !!l[1])
        .slice(0, 6);
      if (linhas.length < 2) return null;
      out.colunas = [cols[0] || 'Antes', cols[1] || 'Depois'];
      out.linhas = linhas;
      break;
    }
    case 'grafico': {
      const barras = (Array.isArray(raw.barras) ? raw.barras : [])
        .filter(isObj)
        .map((b) => ({ rotulo: s(b.rotulo, 18), valor: Number(b.valor) }))
        .filter((b) => b.rotulo && Number.isFinite(b.valor) && b.valor >= 0)
        .slice(0, 7);
      if (barras.length < 2 || !barras.some((b) => b.valor > 0)) return null;
      out.barras = barras;
      out.valores = raw.valores === true;
      const u = s(raw.unidade, 8);
      if (u) out.unidade = u;
      if (!titulo) return null;
      break;
    }
    default:
      break;
  }
  return out;
}

/** Instruções para a IA escolher e preencher o formato da imagem. */
export function arteRules(kind: 'imagem' | 'carrossel', recentes: string[] = []) {
  const evitar = recentes.length ? `\nFormatos usados nos últimos posts desta pessoa (varie, evite repetir o mesmo seguido): ${recentes.join(', ')}.` : '';
  if (kind === 'carrossel')
    return `"arte": como as imagens do carrossel vão parecer. Use { "tipo": "documento" } (páginas de caderno, com cara de anotação de quem entende do assunto) na maioria das vezes, ou { "tipo": "frase" } para o visual de marca da pessoa.${evitar}`;
  return `"arte": o FORMATO da imagem. Fuja do cartão com frase de efeito, que tem cara de IA. Escolha o formato que conta melhor ESTA ideia e preencha os dados:
- "post": print de um post curto da própria pessoa (opinião forte, frase que gera debate). { "tipo": "post", "texto": "até 280 caracteres, na voz dela" }
- "conversa": print de conversa de mensagens mostrando uma situação TÍPICA do dia a dia do público (objeção, pergunta comum, bastidor). Contato genérico pelo papel ("Cliente", "Lead", "Gerente", "Sócio"), nunca nome de pessoa. 3 a 6 mensagens curtas, "de": "outro" ou "eu". { "tipo": "conversa", "contato": "Cliente", "mensagens": [{ "de": "outro", "texto": "..." }] }
- "lista": checklist prático. { "tipo": "lista", "titulo": "...", "itens": [{ "texto": "até 60 caracteres", "feito": true|false }] } com 4 a 6 itens.
- "comparativo": duas colunas (Antes x Depois, Mito x Verdade, Amador x Profissional). { "tipo": "comparativo", "titulo": "...", "colunas": ["...", "..."], "linhas": [["...", "..."]] } com 3 a 5 linhas curtas.
- "grafico": barras simples. Números SÓ se vieram da pessoa (entrevista, contexto, história): aí "valores": true. Sem dado real, mostre só a forma da ideia (ex.: esforço x resultado ao longo das semanas) com "valores": false. { "tipo": "grafico", "titulo": "...", "barras": [{ "rotulo": "até 12 letras", "valor": 0-100 }], "valores": true|false, "unidade": "%", "nota": "de onde vem o dado ou o que o gráfico mostra" }
- "anotacao": nota escrita à mão num post-it, frase curta e pessoal. { "tipo": "anotacao", "texto": "até 140 caracteres", "destaque": "trecho exato a sublinhar" }
- "frase": o cartão com a frase no visual da marca (use pouco).
Não invente fatos, números, clientes nem depoimentos.${evitar}`;
}
