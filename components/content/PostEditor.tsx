'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NetworkIcon } from '@/components/NetworkIcon';
import { StatusPill } from '@/components/content/WeekBoard';
import { networkByName } from '@/lib/networks';
import { formatLong } from '@/lib/dates';
import { autoBlocker, canAutoPublish, captionWithTags, IMAGE_STYLES, kindOf, type MediaItem, type PostAsset, type PostContent, type PostRow } from '@/lib/contentTypes';
import { downloadImage, imagesFor, renderImage, type Brand } from '@/lib/postImage';
import { mediaUrl, type Scene } from '@/lib/scene';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { CanvasEditor } from '@/components/content/CanvasEditor';
import { savePost, setPostStatus } from '@/app/app/conteudos/actions';
import { schedulePost, uploadPostAsset } from '@/app/app/conteudos/publish';
import { AutoPublish, type AutoInfo } from '@/components/content/AutoPublish';
import { AiAsk, type AiReply } from '@/components/AiAsk';
import { PostPerformance, type PostPerf } from '@/components/perf/PostPerformance';
import { nextVariant, variantFor, type Visual } from '@/lib/visual';

const OPEN_URL: Record<string, string> = {
  LinkedIn: 'https://www.linkedin.com/feed/?shareActive=true',
  Instagram: 'https://www.instagram.com/',
  TikTok: 'https://www.tiktok.com/upload',
  'YouTube Shorts': 'https://studio.youtube.com/',
  Facebook: 'https://www.facebook.com/',
  Threads: 'https://www.threads.net/',
};

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const slug = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'post';

const AI_SUGGESTIONS: Record<string, string[]> = {
  carrossel: ['Deixe o gancho da capa mais forte', 'Encurte o texto dos slides', 'Termine pedindo para salvar o post', 'Tom mais descontraído'],
  video: ['Roteiro mais curto, até 30 segundos', 'Gancho mais provocativo nos 3 primeiros segundos', 'Troque a chamada final por seguir o perfil', 'Fala mais natural, como conversa'],
  stories: ['Troque a enquete por uma caixinha de perguntas', 'Textos mais curtos', 'Termine com o link da oferta'],
  thread: ['Corte para 5 posts', 'Primeiro post mais polêmico', 'Mais exemplos práticos'],
  padrao: ['Deixe mais curto e direto', 'Tom mais descontraído', 'Termine com uma pergunta para comentar', 'Hashtags mais específicas'],
};

// undefined some na ida ao servidor; null avisa que foi removido.
const toPayload = (c: PostContent) => ({ ...c, foto: c.foto ?? null, video: c.video ?? null, canvas: c.canvas ?? null });

function scriptText(c: PostContent) {
  if (!c.roteiro) return '';
  const cenas = c.roteiro.cenas.map((s, i) => `Cena ${i + 1}\nFala: ${s.fala}\nNa tela: ${s.visual}`).join('\n\n');
  return `Capa: ${c.roteiro.capa}\nDuração: ${c.roteiro.duracao}\n\n${cenas}`;
}

export function PostEditor({
  post,
  brand,
  serieNumero,
  versionsLeft,
  adjustMax,
  media,
  canCanvas,
  auto,
  defaultTime,
  perf = null,
  preview = false,
  cardPending = false,
  first = false,
  market = 'br',
  brandVisual = null,
}: {
  post: PostRow;
  brand: Brand;
  serieNumero?: number;
  versionsLeft: number;
  adjustMax: number;
  media: MediaItem[];
  canCanvas: boolean;
  auto: AutoInfo;
  defaultTime: string;
  perf?: PostPerf;
  market?: 'br' | 'pt';
  /** Identidade visual da marca (para o estilo "Seu estilo"). */
  brandVisual?: Visual | null;
  /** Conta na prévia (sem cartão): sem refazer nem ajustar com a IA. */
  preview?: boolean;
  /** Grupo do cartão (teste A/B): ainda não ativou os 7 dias. */
  cardPending?: boolean;
  /** Acabou de sair da entrevista: mostra a comemoração do primeiro post. */
  first?: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState<PostContent>(post.content);
  const [saved, setSaved] = useState(() => JSON.stringify(post.content));
  const [status, setStatus] = useState(post.status);
  const [pub, setPub] = useState({ scheduledAt: post.scheduled_at, externalUrl: post.external_url, publishError: post.publish_error });
  const [left, setLeft] = useState(versionsLeft);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState('');
  const [confirmRedo, setConfirmRedo] = useState(false);
  const [redoing, setRedoing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState<'' | 'foto' | 'video'>('');
  const [aiPrev, setAiPrev] = useState<PostContent | null>(null);
  const [editing, setEditing] = useState(false);

  const kind = kindOf(post.formato);
  const net = networkByName(post.rede);
  const dirty = JSON.stringify(c) !== saved;

  // ----- imagens -----
  // Data e horário que aparecem na imagem estilo bloco de notas (o do agendamento, se houver).
  const metaTime = pub.scheduledAt
    ? new Date(pub.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : defaultTime;
  const metaDate = pub.scheduledAt ? new Date(pub.scheduledAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : post.date;
  const specs = useMemo(() => imagesFor(post.formato, c, brand, serieNumero, { date: metaDate, time: metaTime }), [post.formato, c, brand, serieNumero, metaDate, metaTime]);
  const [urls, setUrls] = useState<string[]>([]);
  const [slide, setSlide] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!specs.length) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const out: string[] = [];
      for (const s of specs) out.push((await renderImage(s, c)).toDataURL('image/png'));
      setUrls(out);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [specs, c]);
  useEffect(() => {
    if (slide > specs.length - 1) setSlide(Math.max(0, specs.length - 1));
  }, [specs.length, slide]);

  const set = (patch: Partial<PostContent>) => setC((prev) => ({ ...prev, ...patch }));

  // ----- visual próprio (identidade da marca) -----
  const [visualBusy, setVisualBusy] = useState(false);
  const [visualAsk, setVisualAsk] = useState(false);
  const [visualPedido, setVisualPedido] = useState('');
  const [visualNote, setVisualNote] = useState('');
  async function newVisual(pedido = '') {
    setVisualBusy(true);
    setVisualNote('');
    try {
      const res = await fetch('/api/visual', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'post', postId: post.id, pedido }) });
      const data = (await res.json().catch(() => ({}))) as { visual?: Visual; porque?: string; error?: string };
      if (!res.ok || !data.visual) {
        flash('error', data.error || 'Não deu para criar o visual agora.');
        return;
      }
      // O servidor já salvou o visual; o resto do que a pessoa editou continua aqui para salvar.
      setC((prev) => {
        const next = { ...prev, estilo: 'marca' as const, visual: data.visual };
        delete next.canvas;
        return next;
      });
      setVisualNote(data.porque || '');
      setVisualAsk(false);
      setVisualPedido('');
    } finally {
      setVisualBusy(false);
    }
  }
  function chooseStyle(id: PostContent['estilo']) {
    if (id !== 'marca') return set({ estilo: id });
    if (c.visual) return set({ estilo: 'marca' });
    if (brandVisual) return set({ estilo: 'marca', visual: variantFor(brandVisual, post.item_index) });
    void newVisual();
  }

  function flash(kind: 'ok' | 'error', text: string) {
    setMsg({ kind, text });
    if (kind === 'ok') setTimeout(() => setMsg(null), 2500);
  }

  /** Desenha as imagens do post em JPEG e guarda para a publicação automática. */
  async function prepareAssets(): Promise<PostAsset[]> {
    if (dirty) {
      const r = await savePost(post.id, toPayload(c));
      if (!r.ok) throw new Error(r.error);
      setSaved(JSON.stringify(c));
    }
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
      const r = await uploadPostAsset(post.id, fd);
      if (!r.ok || !r.asset) throw new Error(r.ok ? 'Não deu para preparar as imagens.' : r.error);
      out.push(r.asset);
    }
    return out;
  }

  function save() {
    startTransition(async () => {
      const res = await savePost(post.id, toPayload(c));
      if (!res.ok) return flash('error', res.error);
      setSaved(JSON.stringify(c));
      // Post agendado: atualiza as imagens e o texto que vão ser publicados.
      if (status === 'agendado' && pub.scheduledAt && new Date(pub.scheduledAt).getTime() > Date.now()) {
        try {
          const r = await schedulePost(post.id, pub.scheduledAt, await prepareAssets());
          if (!r.ok) throw new Error(r.error);
          flash('ok', 'Alterações salvas e agendamento atualizado.');
        } catch (err) {
          flash('error', err instanceof Error ? err.message : 'Salvo, mas não deu para atualizar o agendamento.');
        }
      } else flash('ok', 'Alterações salvas.');
    });
  }

  function changeStatus(next: 'rascunho' | 'aprovado' | 'publicado') {
    startTransition(async () => {
      if (dirty) {
        const r = await savePost(post.id, toPayload(c));
        if (!r.ok) return flash('error', r.error);
        setSaved(JSON.stringify(c));
      }
      const res = await setPostStatus(post.id, next);
      if (res.ok) {
        setStatus(next);
        setPub((p) => ({ ...p, scheduledAt: null, publishError: null }));
        flash('ok', next === 'aprovado' ? 'Post aprovado.' : next === 'publicado' ? 'Marcado como publicado.' : 'Voltou para revisão.');
        router.refresh();
      } else flash('error', res.error);
    });
  }

  async function redo() {
    setConfirmRedo(false);
    setRedoing(true);
    setMsg(null);
    try {
      // A IA lê a foto escolhida do que está salvo.
      if (dirty) {
        const r = await savePost(post.id, toPayload(c));
        if (!r.ok) throw new Error(r.error);
      }
      const res = await fetch('/api/conteudos/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: post.item_index }) });
      const json = (await res.json().catch(() => ({}))) as { post?: PostRow; error?: string };
      if (!res.ok || !json.post) throw new Error(json.error || 'Não deu para refazer agora.');
      setC(json.post.content);
      setSaved(JSON.stringify(json.post.content));
      setStatus(json.post.status);
      setLeft((l) => Math.max(0, l - 1));
      setSlide(0);
      flash('ok', 'Nova versão pronta.');
      router.refresh();
    } catch (err) {
      flash('error', err instanceof Error ? err.message : 'Não deu para refazer agora.');
    } finally {
      setRedoing(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      flash('error', 'Não deu para copiar. Selecione o texto e copie manualmente.');
    }
  }

  async function downloadAll() {
    const base = `${post.date}-${slug(post.tema)}`;
    for (let i = 0; i < specs.length; i++) {
      await downloadImage(specs[i], c, specs.length > 1 ? `${base}-${i + 1}.png` : `${base}.png`);
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  const caption = captionWithTags(c);

  /** Publicação manual num clique: abre a rede, copia o texto e baixa as imagens. */
  function copyAndOpen() {
    // Abre antes de qualquer await, senão o navegador bloqueia a nova aba.
    window.open(OPEN_URL[post.rede] ?? 'https://www.linkedin.com/feed/', '_blank', 'noopener');
    const text = kind === 'thread' && c.partes ? c.partes.join('\n\n') : caption;
    void copy(text, 'abrir');
    if (specs.length > 0 && !c.roteiro) void downloadAll();
    flash('ok', `Texto copiado${specs.length && !c.roteiro ? ' e imagem baixada' : ''}. Cole no ${post.rede}${specs.length && !c.roteiro ? ', anexe a imagem' : ''} e volte aqui para marcar "Publiquei".`);
  }

  const autoOk = auto.available && canAutoPublish(post.rede, post.formato);
  // Com a rede conectada e o post pronto, aprovar e agendar é um botão só.
  const canSchedule = autoOk && auto.connected && !autoBlocker(post.rede, post.formato, c);
  const edited = specs.some((s) => c.canvas?.[s.key]);

  function applyCanvas(canvas: Record<string, Scene>) {
    const next = { ...c, canvas };
    setC(next);
    setEditing(false);
    startTransition(async () => {
      const res = await savePost(post.id, toPayload(next));
      if (res.ok) {
        setSaved(JSON.stringify(next));
        flash('ok', 'Imagens editadas salvas.');
      } else flash('error', res.error);
    });
  }

  async function askAi(pedido: string): Promise<AiReply> {
    const res = await fetch('/api/conteudos/ajustar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId: post.id, pedido }) });
    const json = (await res.json().catch(() => ({}))) as { content?: PostContent; resposta?: string; left?: number; error?: string };
    if (!res.ok || !json.content) return { ok: false, error: json.error || 'A IA não conseguiu ajustar agora.' };
    setAiPrev(c);
    setC(json.content);
    setSlide(0);
    return { ok: true, resposta: json.resposta ?? 'Pronto, ajustei.', left: json.left };
  }

  function pickVideo(m: MediaItem | null) {
    setPicker('');
    set({ video: m ? m.id : undefined });
    if (m) flash('ok', 'Vídeo escolhido. Salve para usar no reels.');
  }

  function pickPhoto(m: MediaItem | null) {
    setPicker('');
    set({ foto: m ? m.id : undefined });
    if (m) flash('ok', 'Foto escolhida. Salve e, se quiser, use "Refazer com IA" para o texto combinar com ela.');
  }

  return (
    <div className="postPage">
      <div className="postHead">
        <Link href="/app/conteudos" className="backLink">‹ Conteúdos da semana</Link>
        <div className="eyebrow">{cap(formatLong(post.date))}</div>
        <h1 className="pageTitle">{post.tema}</h1>
        <div className="postMeta">
          {net && <NetworkIcon id={net.id} size={24} />}
          <span>{post.rede}</span>
          <span className="sep">·</span>
          <span>{post.formato}</span>
          <span className="sep">·</span>
          <span>{post.com_rosto ? 'com rosto' : 'sem rosto'}</span>
          <span className="sep">·</span>
          <span>objetivo: {post.objetivo}</span>
          <StatusPill status={status} />
        </div>
      </div>

      {first && (
        <div className="firstPost rise" role="status">
          <span className="firstPostEmoji" aria-hidden="true">🎉</span>
          <div>
            <b>Seu primeiro post está pronto.</b>
            <span>
              {cardPending
                ? ` Feito a partir da sua entrevista e da sua estratégia. Já dá para postar: um clique copia o texto${specs.length && !c.roteiro ? ', baixa a imagem' : ''} e abre o ${post.rede}. Para publicar no automático e liberar o mês inteiro, ative seus 7 dias grátis: nada é cobrado hoje.`
                : preview
                ? ' Feito a partir da sua entrevista e da sua estratégia. Seu teste acabou: assine para publicar direto no LinkedIn e liberar o mês inteiro.'
                : ` Feito a partir da sua entrevista e da sua estratégia. Revise, ajuste com a IA se quiser e publique hoje. Não precisa conectar nada agora: um clique copia o texto${specs.length && !c.roteiro ? ', baixa a imagem' : ''} e abre o ${post.rede}.`}
            </span>
          </div>
          {cardPending ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn3d btnSm" onClick={copyAndOpen}>{copied === 'abrir' ? 'Texto copiado!' : `Copiar e abrir o ${post.rede}`}</button>
              <a className="btnGhost btnSm" href="/app/assinar">Ativar 7 dias grátis</a>
            </div>
          ) : preview ? (
            <a className="btn3d btnSm" href="/app/assinar">Assinar e continuar</a>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn3d btnSm" onClick={copyAndOpen}>{copied === 'abrir' ? 'Texto copiado!' : `Copiar e abrir o ${post.rede}`}</button>
              <a className="btnGhost btnSm" href="#publicar">Ver como publicar</a>
            </div>
          )}
        </div>
      )}
      {!first && !preview && status !== 'publicado' && status !== 'agendado' && status !== 'publicando' && (
        <a className="pubJump" href="#publicar">Pronto para publicar? Ir para Publicar ↓</a>
      )}
      {first && (
        <a className="card moreAnswers" href="/app/entrevista?completa=1">
          <b>Quer os próximos posts ainda mais a sua cara?</b>
          <span className="muted">Responda mais 8 perguntas (uns 2 minutos): dores do seu cliente, temas e limites. A estratégia fica mais afiada. →</span>
        </a>
      )}
      {preview && status !== 'publicado' && (
        <div className="card previewLock">
          <b>{market === 'pt' ? 'O seu teste terminou' : cardPending ? 'Ative seus 7 dias grátis' : 'Seu teste grátis acabou'}</b>
          <span className="muted">{market === 'pt' ? 'Assine para continuar a ajustar com a IA e a publicar.' : cardPending ? 'Para ajustar com a IA, agendar no automático e liberar o mês inteiro. Nada é cobrado hoje: a primeira cobrança é no 8º dia e você cancela em 1 clique. Você já pode editar o texto e postar copiando.' : 'Assine para voltar a ajustar com a IA, refazer e publicar. Você ainda pode editar o texto à mão.'}</span>
          <a className="linkBtn" href="/app/assinar">{cardPending ? 'Ativar 7 dias grátis →' : 'Assinar →'}</a>
        </div>
      )}
      {!preview && status !== 'publicado' && status !== 'publicando' && (
        <AiAsk
          title="Peça à IA"
          hint="Diga o que quer mudar neste post. A IA ajusta e você revisa antes de salvar."
          placeholder="Ex.: deixe o gancho mais forte e fale do lançamento de sexta"
          suggestions={AI_SUGGESTIONS[kind] ?? AI_SUGGESTIONS.padrao}
          left={adjustMax - (post.content.ajustes ?? 0)}
          max={adjustMax}
          onAsk={askAi}
        >
          {aiPrev && (
            <span className="aiAskActs">
              {dirty ? (
                <>
                  <button type="button" className="btn3d btnSm" onClick={save} disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</button>
                  <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => (setC(aiPrev), setAiPrev(null))}>Desfazer</button>
                </>
              ) : (
                <span style={{ fontSize: 13 }}>Salvo ✓</span>
              )}
              {aiPrev.canvas && !c.canvas && dirty && <span style={{ fontSize: 12, fontWeight: 500, flexBasis: '100%' }}>O texto das imagens mudou, então as edições feitas no canvas voltaram ao modelo.</span>}
            </span>
          )}
        </AiAsk>
      )}

      <div className="postGrid">
        {/* Prévia */}
        <section className="panel previewPanel" aria-label="Prévia">
          {specs.length > 0 ? (
            <>
              <div className="previewStage" style={{ aspectRatio: `${specs[slide]?.w ?? 1080} / ${specs[slide]?.h ?? 1350}` }}>
                {urls[slide] ? <img src={urls[slide]} alt={specs[slide]?.label ?? ''} /> : <div className="spinner" />}
              </div>
              {specs.length > 1 && (
                <div className="calNav" style={{ justifyContent: 'center' }}>
                  <button type="button" className="calIconBtn" onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} aria-label="Imagem anterior">‹</button>
                  <span className="calMonth" style={{ minWidth: 110 }}>{specs[slide]?.label} · {slide + 1}/{specs.length}</span>
                  <button type="button" className="calIconBtn" onClick={() => setSlide((s) => Math.min(specs.length - 1, s + 1))} disabled={slide === specs.length - 1} aria-label="Próxima imagem">›</button>
                </div>
              )}
              <div className="styleRow" role="radiogroup" aria-label="Estilo das imagens">
                {IMAGE_STYLES.map((s) => {
                  const vv = s.id === 'marca' ? c.visual ?? brandVisual : null;
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={(c.estilo ?? 'notas') === s.id} className={`styleChip ${s.id}`} onClick={() => chooseStyle(s.id)} disabled={visualBusy}>
                      <span className="styleSwatch" aria-hidden="true" style={vv ? { background: `linear-gradient(135deg, ${vv.cores.fundo} 55%, ${vv.cores.acento} 55%)` } : undefined} />
                      {s.nome}
                    </button>
                  );
                })}
              </div>
              {(c.estilo === 'marca' || visualBusy) && (
                <div className="visualBar">
                  {visualBusy ? (
                    <span className="visualInfo"><span className="spinner" style={{ width: 16, height: 16 }} /> Criando um visual a partir das suas referências e do seu perfil…</span>
                  ) : c.visual ? (
                    <span className="visualInfo">
                      <b>{c.visual.nome}</b>
                      {visualNote ? <span className="muted"> · {visualNote}</span> : null}
                    </span>
                  ) : null}
                  {!visualBusy && c.visual && (
                    <div className="visualActions">
                      <button type="button" className="btnGhost btnSm" onClick={() => set({ visual: nextVariant(c.visual!), canvas: undefined })}>Outro layout</button>
                      <button type="button" className="btnGhost btnSm" onClick={() => setVisualAsk((v) => !v)} disabled={preview}>✨ Novo visual com IA</button>
                    </div>
                  )}
                  {visualAsk && !visualBusy && (
                    <form
                      className="visualAsk"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void newVisual(visualPedido);
                      }}
                    >
                      <input className="input" value={visualPedido} onChange={(e) => setVisualPedido(e.target.value)} placeholder="Opcional: mais minimalista, fundo escuro, cores da minha marca…" maxLength={300} />
                      <button type="submit" className="btn3d btnSm">Criar</button>
                    </form>
                  )}
                  {!visualBusy && (
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      A IA usa suas <Link href="/app/conteudos/fotos">referências de estilo</Link> e a sua entrevista. Quanto mais referências, mais a sua cara.
                    </span>
                  )}
                </div>
              )}
              <div className="previewActions">
                {canCanvas ? (
                  <button type="button" className="btnGhost btnSm" onClick={() => setEditing(true)}>Editar no canvas</button>
                ) : (
                  <Link className="btnGhost btnSm lockedBtn" href="/app/plano" title="Disponível no plano Pro">Editar no canvas · Pro</Link>
                )}
                <button type="button" className="btn3d btnSm" onClick={downloadAll}>
                  Baixar {specs.length > 1 ? `${specs.length} imagens` : 'imagem'}
                </button>
              </div>
              {edited && (
                <div className="formNote" style={{ fontWeight: 500, fontSize: 13 }}>
                  Imagem editada no canvas: mudanças no texto ao lado não aparecem nela.{' '}
                  <button type="button" className="linkBtn" style={{ fontSize: 13, minHeight: 0 }} onClick={() => set({ canvas: undefined })}>Voltar ao modelo</button>
                </div>
              )}
            </>
          ) : (
            <div className="textPreview">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="avatar" style={{ width: 40, height: 40 }}>{brand.name.slice(0, 1).toUpperCase()}</span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <b style={{ fontSize: 14 }}>{brand.name}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{brand.handle ?? post.rede}</span>
                </span>
              </div>
              <div className="textPreviewBody">{kind === 'thread' && c.partes ? c.partes.join('\n\n— — —\n\n') : caption}</div>
              {kind === 'texto' &&
                (c.foto ? (
                  <button type="button" className="previewPhoto" style={{ padding: 0, border: 0, cursor: 'pointer' }} onClick={() => setPicker('foto')} aria-label="Trocar a foto">
                    <img src={mediaUrl(c.foto)} alt="Foto do post" style={{ width: '100%', borderRadius: 10, display: 'block', maxHeight: 420, objectFit: 'cover' }} />
                  </button>
                ) : (
                  <button type="button" className="previewPhoto empty" onClick={() => setPicker('foto')}>
                    <b>Coloque sua foto aqui</b>
                    <span>Pode ser qualquer foto sua</span>
                  </button>
                ))}
            </div>
          )}
          <div className="photoRow">
            {c.foto ? (
              <img className="photoThumb" src={mediaUrl(c.foto, true)} alt="Foto do post" />
            ) : (
              <span className="photoThumb empty" aria-hidden="true">+</span>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
              <b style={{ fontSize: 14 }}>{c.foto ? 'Foto do post' : 'Usar uma foto sua'}</b>
              <span className="muted" style={{ fontSize: 12 }}>{c.foto ? 'Vira o fundo da imagem e a IA escreve olhando para ela.' : 'Da sua biblioteca ou envie uma nova.'}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="btnGhost btnSm" onClick={() => setPicker('foto')}>{c.foto ? 'Trocar' : 'Escolher'}</button>
              {c.foto && <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => pickPhoto(null)}>Tirar</button>}
            </div>
          </div>
          {kind === 'video' && (
            <div className="photoRow">
              {c.video ? (
                <span className="photoThumb" style={{ position: 'relative', overflow: 'hidden' }}>
                  <img src={mediaUrl(c.video, true)} alt="Vídeo do post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span className="mediaPlay" aria-hidden="true" style={{ width: 24, height: 24, fontSize: 10 }}>▶</span>
                </span>
              ) : (
                <span className="photoThumb empty" aria-hidden="true">▶</span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                <b style={{ fontSize: 14 }}>{c.video ? 'Vídeo do reels' : 'Vídeo gravado'}</b>
                <span className="muted" style={{ fontSize: 12 }}>{c.video ? 'É ele que vai para o ar, com a legenda e a capa.' : 'Grave com o roteiro e envie aqui para agendar.'}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btnGhost btnSm" onClick={() => setPicker('video')}>{c.video ? 'Trocar' : 'Escolher'}</button>
                {c.video && <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => pickVideo(null)}>Tirar</button>}
              </div>
            </div>
          )}
        </section>

        {/* Edição */}
        <section className="card editorPanel" aria-label="Editar conteúdo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 17 }}>Texto e conteúdo</h2>
            <span className="muted" style={{ fontSize: 12 }}>{post.source === 'demo' ? 'Versão de demonstração' : 'Escrito pela IA no seu estilo'}</span>
          </div>

          {c.imagem && (
            <div className="field">
              <label htmlFor="f-frase">{kind === 'prova' ? 'Depoimento na imagem' : 'Frase da imagem'}</label>
              <textarea id="f-frase" rows={3} value={c.imagem.frase} onChange={(e) => set({ imagem: { ...c.imagem!, frase: e.target.value } })} />
              {kind === 'imagem' && (
                <input aria-label="Trecho em destaque" placeholder="Trecho em destaque (copie da frase)" value={c.imagem.destaque ?? ''} onChange={(e) => set({ imagem: { ...c.imagem!, destaque: e.target.value } })} />
              )}
            </div>
          )}

          {c.slides && (
            <div className="field">
              <label>Slides do carrossel</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.slides.map((s, i) => (
                  <div key={i} className="slideEdit" onFocus={() => setSlide(i)}>
                    <span className="slideNum">{i + 1}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                      <input aria-label={`Título do slide ${i + 1}`} value={s.titulo} onChange={(e) => set({ slides: c.slides!.map((x, k) => (k === i ? { ...x, titulo: e.target.value } : x)) })} />
                      <textarea aria-label={`Texto do slide ${i + 1}`} rows={2} value={s.texto} onChange={(e) => set({ slides: c.slides!.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)) })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.roteiro && (
            <div className="field">
              <label>Roteiro do vídeo · {c.roteiro.duracao}</label>
              <input aria-label="Texto da capa" value={c.roteiro.capa} onChange={(e) => set({ roteiro: { ...c.roteiro!, capa: e.target.value } })} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.roteiro.cenas.map((s, i) => (
                  <div key={i} className="slideEdit">
                    <span className="slideNum">{i + 1}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0 }}>
                      <textarea aria-label={`Fala da cena ${i + 1}`} rows={2} value={s.fala} onChange={(e) => set({ roteiro: { ...c.roteiro!, cenas: c.roteiro!.cenas.map((x, k) => (k === i ? { ...x, fala: e.target.value } : x)) } })} />
                      <input aria-label={`O que aparece na cena ${i + 1}`} value={s.visual} onChange={(e) => set({ roteiro: { ...c.roteiro!, cenas: c.roteiro!.cenas.map((x, k) => (k === i ? { ...x, visual: e.target.value } : x)) } })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.stories && (
            <div className="field">
              <label>Sequência de stories</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.stories.map((s, i) => (
                  <div key={i} className="slideEdit" onFocus={() => setSlide(i)}>
                    <span className="slideNum">{i + 1}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
                      <span className="muted" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{s.tipo}{s.opcoes ? ` · ${s.opcoes.join(' / ')}` : ''}</span>
                      <textarea aria-label={`Texto do story ${i + 1}`} rows={2} value={s.texto} onChange={(e) => set({ stories: c.stories!.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)) })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {c.partes && (
            <div className="field">
              <label>Posts da thread</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.partes.map((t, i) => (
                  <div key={i} className="slideEdit">
                    <span className="slideNum">{i + 1}</span>
                    <textarea aria-label={`Post ${i + 1} da thread`} rows={3} value={t} onChange={(e) => set({ partes: c.partes!.map((x, k) => (k === i ? e.target.value : x)) })} style={{ flex: 1, minWidth: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="f-legenda">{kind === 'texto' ? 'Post' : 'Legenda'}</label>
            <textarea id="f-legenda" rows={kind === 'texto' ? 14 : 9} value={c.legenda} onChange={(e) => set({ legenda: e.target.value })} />
            <span className="muted" style={{ fontSize: 12 }}>{c.legenda.length} caracteres</span>
          </div>

          <div className="field">
            <label htmlFor="f-tags">Hashtags</label>
            <input
              id="f-tags"
              value={c.hashtags.map((h) => `#${h}`).join(' ')}
              onChange={(e) => set({ hashtags: e.target.value.split(/[\s,]+/).map((h) => h.replace(/^#/, '')).filter(Boolean) })}
              placeholder="#vendas #lideranca"
            />
          </div>

          {msg && <div role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'formError' : 'formOk'}>{msg.text}</div>}

          <div className="editorBar">
            <button type="button" className="btn3d btnSm" onClick={save} disabled={!dirty || pending}>{pending ? 'Salvando…' : dirty ? 'Salvar alterações' : 'Tudo salvo'}</button>
            {confirmRedo ? (
              <span className="redoConfirm">
                <span className="muted" style={{ fontSize: 13 }}>A nova versão substitui o texto atual.</span>
                <button type="button" className="btnGhost btnSm" onClick={redo}>Refazer</button>
                <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => setConfirmRedo(false)}>Cancelar</button>
              </span>
            ) : (
              <button type="button" className="btnGhost btnSm" onClick={() => setConfirmRedo(true)} disabled={redoing || left === 0}>
                {redoing ? 'Refazendo…' : preview ? 'Refazer: no teste' : left === 0 ? 'Sem refações' : `Refazer com IA (${left})`}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Publicar */}
      <section className="card publishPanel" aria-labelledby="h-pub" id="publicar" style={{ scrollMarginTop: 80 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 id="h-pub" style={{ fontSize: 17 }}>Publicar</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              {autoOk ? 'Agende para sair sozinho ou, se preferir, publique você mesmo em 4 toques.' : 'Enquanto a publicação automática não chega para este formato, são 4 toques.'}
            </span>
          </div>
          <div className="pageActions" style={{ width: 'auto' }}>
            {/* Com a rede conectada, aprovar é no quadro abaixo: aprovou, agendou. */}
            {status === 'rascunho' && !canSchedule && (
              <button type="button" className="btn3d btnSm" onClick={() => changeStatus('aprovado')} disabled={pending}>Aprovar post</button>
            )}
            {status === 'aprovado' && <button type="button" className="btn3d btnSm" onClick={() => changeStatus('publicado')} disabled={pending}>Marcar como publicado</button>}
            {status !== 'rascunho' && status !== 'publicando' && <button type="button" className="btnGhost btnSm" onClick={() => changeStatus('rascunho')} disabled={pending}>Voltar para revisão</button>}
          </div>
        </div>
        {autoOk && (
          <AutoPublish
            postId={post.id}
            rede={post.rede}
            date={post.date}
            defaultTime={defaultTime}
            auto={auto}
            state={{ status, ...pub }}
            prepareAssets={prepareAssets}
            blocker={autoBlocker(post.rede, post.formato, c)}
            beforeSchedule={async () => {
              if (!dirty) return null;
              const r = await savePost(post.id, toPayload(c));
              if (!r.ok) return r.error;
              setSaved(JSON.stringify(c));
              return null;
            }}
            onChange={(next) => {
              setStatus(next.status);
              setPub({ scheduledAt: next.scheduledAt, externalUrl: next.externalUrl, publishError: next.publishError });
            }}
          />
        )}
        <ol className="pubSteps">
          <li>
            <span className="slideNum">1</span>
            <div>
              <b>Copie o texto</b>
              <span className="muted">{kind === 'thread' ? 'Cada post da thread separado.' : 'Legenda com as hashtags.'}</span>
            </div>
            {kind === 'thread' && c.partes ? (
              <button type="button" className="btnGhost btnSm" onClick={() => copy(c.partes!.join('\n\n'), 'texto')}>{copied === 'texto' ? 'Copiado!' : 'Copiar thread'}</button>
            ) : (
              <button type="button" className="btnGhost btnSm" onClick={() => copy(caption, 'texto')}>{copied === 'texto' ? 'Copiado!' : 'Copiar legenda'}</button>
            )}
          </li>
          {(specs.length > 0 || c.roteiro) && (
            <li>
              <span className="slideNum">2</span>
              <div>
                <b>{c.roteiro ? 'Grave com o roteiro' : 'Baixe as imagens'}</b>
                <span className="muted">{c.roteiro ? 'Copie o roteiro e baixe a capa.' : specs.length > 1 ? 'Na ordem dos slides.' : 'Em alta resolução.'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {c.roteiro && <button type="button" className="btnGhost btnSm" onClick={() => copy(scriptText(c), 'roteiro')}>{copied === 'roteiro' ? 'Copiado!' : 'Copiar roteiro'}</button>}
                {specs.length > 0 && <button type="button" className="btnGhost btnSm" onClick={downloadAll}>Baixar</button>}
              </div>
            </li>
          )}
          <li>
            <span className="slideNum">{specs.length > 0 || c.roteiro ? 3 : 2}</span>
            <div>
              <b>Abra o {post.rede}</b>
              <span className="muted">Cole o texto e anexe {c.roteiro ? 'o vídeo' : specs.length ? 'as imagens' : 'o que precisar'}.</span>
            </div>
            <a className="btnGhost btnSm" href={OPEN_URL[post.rede] ?? '#'} target="_blank" rel="noopener noreferrer">Abrir {post.rede}</a>
          </li>
          <li>
            <span className="slideNum">{specs.length > 0 || c.roteiro ? 4 : 3}</span>
            <div>
              <b>Marque como publicado</b>
              <span className="muted">Assim o painel acompanha sua constância.</span>
            </div>
            <button type="button" className="btnGhost btnSm" onClick={() => changeStatus('publicado')} disabled={pending || status === 'publicado'}>{status === 'publicado' ? 'Publicado ✓' : 'Publiquei'}</button>
          </li>
        </ol>
        {c.dica && (
          <div className="formNote" style={{ fontWeight: 500 }}>
            <b>Dica:</b> {c.dica}
          </div>
        )}
      </section>

      {status === 'publicado' && <PostPerformance postId={post.id} rede={post.rede} perf={perf} />}

      {picker && (
        <div className="canvasPicker" role="dialog" aria-modal="true" aria-label={picker === 'video' ? 'Escolher vídeo do post' : 'Escolher foto do post'}>
          <div className="canvasPickerIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <b>{picker === 'video' ? 'Escolha o vídeo do reels' : 'Escolha a foto do post'}</b>
              <button type="button" className="calIconBtn" onClick={() => setPicker('')} aria-label="Fechar">×</button>
            </div>
            {picker === 'video' ? (
              <MediaLibrary items={media} mode="picker" only="video" onPick={pickVideo} selectedId={c.video} />
            ) : (
              <MediaLibrary items={media.filter((m) => m.kind !== 'video')} mode="picker" only="imagem" onPick={pickPhoto} selectedId={c.foto} />
            )}
          </div>
        </div>
      )}

      {editing && specs.length > 0 && <CanvasEditor specs={specs} content={c} media={media.filter((m) => m.kind !== 'video')} startIndex={slide} onCancel={() => setEditing(false)} onApply={applyCanvas} />}
    </div>
  );
}
