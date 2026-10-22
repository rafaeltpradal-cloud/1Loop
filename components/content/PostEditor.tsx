'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NetworkIcon } from '@/components/NetworkIcon';
import { StatusPill } from '@/components/content/WeekBoard';
import { networkByName } from '@/lib/networks';
import { formatLong } from '@/lib/dates';
import { canAutoPublish, captionWithTags, IMAGE_STYLES, kindOf, type MediaItem, type PostAsset, type PostContent, type PostRow } from '@/lib/contentTypes';
import { downloadImage, imagesFor, renderImage, type Brand } from '@/lib/postImage';
import { mediaUrl, type Scene } from '@/lib/scene';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { CanvasEditor } from '@/components/content/CanvasEditor';
import { savePost, setPostStatus } from '@/app/app/conteudos/actions';
import { schedulePost, uploadPostAsset } from '@/app/app/conteudos/publish';
import { AutoPublish, type AutoInfo } from '@/components/content/AutoPublish';

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

// undefined some na ida ao servidor; null avisa que foi removido.
const toPayload = (c: PostContent) => ({ ...c, foto: c.foto ?? null, canvas: c.canvas ?? null });

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
  media,
  canCanvas,
  auto,
  defaultTime,
}: {
  post: PostRow;
  brand: Brand;
  serieNumero?: number;
  versionsLeft: number;
  media: MediaItem[];
  canCanvas: boolean;
  auto: AutoInfo;
  defaultTime: string;
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
  const [photoPicker, setPhotoPicker] = useState(false);
  const [editing, setEditing] = useState(false);

  const kind = kindOf(post.formato);
  const net = networkByName(post.rede);
  const dirty = JSON.stringify(c) !== saved;

  // ----- imagens -----
  const specs = useMemo(() => imagesFor(post.formato, c, brand, serieNumero), [post.formato, c, brand, serieNumero]);
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
  const autoOk = auto.available && canAutoPublish(post.rede, post.formato);
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

  function pickPhoto(m: MediaItem | null) {
    setPhotoPicker(false);
    set({ foto: m ? m.id : undefined });
    if (m) flash('ok', 'Foto escolhida. Salve e, se quiser, use "Refazer com IA" para o texto combinar com ela.');
  }

  return (
    <div className="postPage">
      <div className="postHead">
        <Link href="/app/conteudos" className="backLink">‹ Conteúdos da semana</Link>
        <div className="eyebrow">{cap(formatLong(post.date))}</div>
        <h1 style={{ fontSize: 'clamp(22px, 2.6vw, 30px)', lineHeight: 1.2, letterSpacing: '-0.6px' }}>{post.tema}</h1>
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
                {IMAGE_STYLES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={(c.estilo ?? 'notas') === s.id} className={`styleChip ${s.id}`} onClick={() => set({ estilo: s.id })}>
                    <span className="styleSwatch" aria-hidden="true" />
                    {s.nome}
                  </button>
                ))}
              </div>
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
              <button type="button" className="btnGhost btnSm" onClick={() => setPhotoPicker(true)}>{c.foto ? 'Trocar' : 'Escolher'}</button>
              {c.foto && <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => pickPhoto(null)}>Tirar</button>}
            </div>
          </div>
        </section>

        {/* Edição */}
        <section className="card editorPanel" aria-label="Editar conteúdo">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 17 }}>Texto e conteúdo</h2>
            <span className="muted" style={{ fontSize: 12 }}>{post.source === 'demo' ? 'Versão de demonstração' : 'Escrito pela IA com a sua voz'}</span>
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
                {redoing ? 'Refazendo…' : left === 0 ? 'Sem refações' : `Refazer com IA (${left})`}
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Publicar */}
      <section className="card publishPanel" aria-labelledby="h-pub">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 id="h-pub" style={{ fontSize: 17 }}>Publicar</h2>
            <span className="muted" style={{ fontSize: 13 }}>
              {autoOk ? 'Agende para sair sozinho ou, se preferir, publique você mesmo em 4 toques.' : 'Enquanto a publicação automática não chega para este formato, são 4 toques.'}
            </span>
          </div>
          <div className="pageActions" style={{ width: 'auto' }}>
            {status === 'rascunho' && <button type="button" className="btn3d btnSm" onClick={() => changeStatus('aprovado')} disabled={pending}>Aprovar post</button>}
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
              <span className="muted">Cole o texto e anexe {specs.length ? 'as imagens' : c.roteiro ? 'o vídeo' : 'o que precisar'}.</span>
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

      {photoPicker && (
        <div className="canvasPicker" role="dialog" aria-modal="true" aria-label="Escolher foto do post">
          <div className="canvasPickerIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <b>Escolha a foto do post</b>
              <button type="button" className="calIconBtn" onClick={() => setPhotoPicker(false)} aria-label="Fechar">×</button>
            </div>
            <MediaLibrary items={media} mode="picker" onPick={pickPhoto} selectedId={c.foto} />
          </div>
        </div>
      )}

      {editing && specs.length > 0 && <CanvasEditor specs={specs} content={c} media={media} startIndex={slide} onCancel={() => setEditing(false)} onApply={applyCanvas} />}
    </div>
  );
}
