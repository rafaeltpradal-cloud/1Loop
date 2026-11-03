'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { VoiceButton } from '@/components/VoiceButton';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { mediaUrl } from '@/lib/scene';
import { fromISO } from '@/lib/dates';
import type { MediaItem } from '@/lib/contentTypes';
import type { Slot } from '../novo/StoryPost';

const label = (iso: string) => fromISO(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');

const PEDIDOS_COM_FOTO = ['Escreva a legenda a partir desta foto', 'Conte o bastidor deste momento', 'Transforme em uma lição para quem vende'];
const PEDIDOS_COM_TEXTO = ['Deixe mais curto', 'Gancho mais forte', 'Mais pessoal', 'Termine com uma pergunta'];
const PEDIDOS_VAZIO = ['Um aprendizado da semana', 'Uma conquista recente', 'Uma opinião sobre o meu mercado'];

type Err = { msg: string; paywall?: boolean } | null;

export function CreatePost({ slots, media, preview, author }: { slots: Slot[]; media: MediaItem[]; preview: boolean; author: { name: string; avatar: string | null } }) {
  const router = useRouter();
  const [foto, setFoto] = useState<number | null>(null);
  const [texto, setTexto] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [pedido, setPedido] = useState('');
  const [undo, setUndo] = useState<{ texto: string; tags: string[] } | null>(null);
  const [slot, setSlot] = useState<number | null>(slots[0]?.index ?? null);
  const [picker, setPicker] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [error, setError] = useState<Err>(null);
  const rede = slots.find((s) => s.index === slot)?.rede ?? 'LinkedIn';

  async function call(body: object) {
    const r = await fetch('/api/conteudos/criar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; paywall?: boolean; legenda?: string; hashtags?: string[]; restantes?: number; post?: { id: number } };
    return { ok: r.ok, j };
  }

  async function askAi(p = pedido) {
    setAiBusy(true);
    setError(null);
    setAiNote('');
    try {
      const { ok, j } = await call({ acao: 'ia', pedido: p, texto, foto, rede });
      if (!ok || !j.legenda) setError({ msg: j.error ?? 'Não deu certo. Tente de novo.', paywall: j.paywall });
      else {
        setUndo({ texto, tags });
        setTexto(j.legenda);
        setTags(j.hashtags ?? []);
        setPedido('');
        setAiNote(typeof j.restantes === 'number' && j.restantes <= 5 ? `Pronto. Restam ${j.restantes} pedidos hoje.` : 'Pronto. Edite o que quiser.');
      }
    } catch {
      setError({ msg: 'Sem conexão. Tente de novo.' });
    }
    setAiBusy(false);
  }

  async function save() {
    if (slot === null) return;
    setSaving(true);
    setError(null);
    try {
      const { ok, j } = await call({ acao: 'salvar', index: slot, texto, foto, hashtags: tags });
      if (!ok || !j.post) {
        setError({ msg: j.error ?? 'Não deu para salvar. Tente de novo.', paywall: j.paywall });
        setSaving(false);
        return;
      }
      router.push(`/app/conteudos/${j.post.id}`);
    } catch {
      setError({ msg: 'Sem conexão. Tente de novo.' });
      setSaving(false);
    }
  }

  const sugestoes = foto ? PEDIDOS_COM_FOTO : texto.trim() ? PEDIDOS_COM_TEXTO : PEDIDOS_VAZIO;

  return (
    <div className="createGrid">
      <div className="createMain">
        {/* Foto */}
        <section className="card createBlock" aria-labelledby="h-foto">
          <div className="createBlockHead">
            <h2 id="h-foto">1. Sua foto <span className="muted">(opcional)</span></h2>
            {foto && <button type="button" className="linkBtn" onClick={() => setFoto(null)}>Tirar foto</button>}
          </div>
          {foto ? (
            <button type="button" className="createPhoto" onClick={() => setPicker(true)} aria-label="Trocar a foto">
              <img src={mediaUrl(foto)} alt="Foto do post" />
              <span className="createPhotoSwap">Trocar</span>
            </button>
          ) : (
            <button type="button" className="createPhoto empty" onClick={() => setPicker(true)}>
              <span className="createPhotoIcon" aria-hidden="true">＋</span>
              <b>Coloque sua foto</b>
              <span className="muted">Qualquer foto sua: evento, reunião, bastidor, selfie. A IA escreve olhando para ela.</span>
            </button>
          )}
        </section>

        {/* Barra de IA */}
        <section className="card createBlock createAi" aria-labelledby="h-ia">
          <h2 id="h-ia">2. Peça à IA <span className="muted">(ou escreva você mesmo abaixo)</span></h2>
          <form
            className="aiBar"
            onSubmit={(e) => {
              e.preventDefault();
              askAi();
            }}
          >
            <span className="aiSpark" aria-hidden="true">✦</span>
            <input
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              maxLength={1500}
              placeholder={foto ? 'Ex.: a partir desta foto, conta que palestrei para 200 vendedores' : 'Ex.: escreva sobre a objeção de preço que ouvi hoje'}
              aria-label="O que você quer que a IA faça"
            />
            <VoiceButton value={pedido} onChange={setPedido} label="Falar" />
            <button type="submit" className="btn3d btnSm" disabled={aiBusy || (!pedido.trim() && !texto.trim() && !foto)}>{aiBusy ? 'Escrevendo…' : 'Criar'}</button>
          </form>
          <div className="storyIdeas">
            {sugestoes.map((s) => (
              <button key={s} type="button" className="chip" disabled={aiBusy} onClick={() => (setPedido(s), askAi(s))}>{s}</button>
            ))}
          </div>
          {aiNote && <div className="formNote" role="status">{aiNote} {undo && <button type="button" className="linkBtn" onClick={() => (setTexto(undo.texto), setTags(undo.tags), setUndo(null), setAiNote(''))}>Desfazer</button>}</div>}
        </section>

        {/* Legenda */}
        <section className="card createBlock" aria-labelledby="h-legenda">
          <h2 id="h-legenda"><label htmlFor="legenda">3. Legenda</label></h2>
          <div className="field">
            <textarea id="legenda" rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={5000} placeholder="Escreva aqui do seu jeito, ou peça para a IA aí em cima." />
          </div>
          <div className="storyTools">
            <VoiceButton value={texto} onChange={setTexto} label="Ditar a legenda" />
            <span className="muted" style={{ fontSize: 12 }}>{texto.length}/5000</span>
          </div>
          {tags.length > 0 && (
            <div className="createTags">
              {tags.map((t) => (
                <button key={t} type="button" className="chip" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Tirar #${t}`}>#{t} ×</button>
              ))}
            </div>
          )}
        </section>

        {/* Dia */}
        <section className="card createBlock">
          {slots.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <b>Todos os dias do seu calendário já têm post.</b>
              <span className="muted" style={{ fontSize: 14 }}>Abra um post ainda não publicado e troque a foto e o texto por estes.</span>
              <div><Link className="btnGhost btnSm" href="/app/conteudos">Ver conteúdos</Link></div>
            </div>
          ) : (
            <fieldset className="storySlots">
              <legend>4. Em qual dia vai sair</legend>
              {slots.map((s) => (
                <label key={s.index} className={slot === s.index ? 'on' : ''}>
                  <input type="radio" name="slot" checked={slot === s.index} onChange={() => setSlot(s.index)} />
                  <b>{label(s.date)}</b>
                  <span className="muted">{s.rede}</span>
                </label>
              ))}
            </fieldset>
          )}
          {error && (
            <div role="alert" className="formError">
              {error.msg} {error.paywall && <Link href="/app/assinar">Começar 7 dias grátis</Link>}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn3d" onClick={save} disabled={saving || slot === null || texto.trim().length < 10}>{saving ? 'Salvando…' : 'Salvar post'}</button>
            <span className="muted" style={{ fontSize: 13 }}>{preview ? 'Conta como um dos posts da prévia.' : 'Conta como um post do mês. Depois você revisa, agenda ou publica.'}</span>
          </div>
        </section>
      </div>

      {/* Prévia */}
      <aside className="createPreview" aria-label="Prévia do post">
        <div className="eyebrow">Prévia · {rede}</div>
        <div className="textPreview">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {author.avatar ? <img className="avatar" src={author.avatar} alt="" style={{ width: 40, height: 40, objectFit: 'cover' }} /> : <span className="avatar" style={{ width: 40, height: 40 }}>{author.name.slice(0, 1).toUpperCase()}</span>}
            <b style={{ fontSize: 14 }}>{author.name}</b>
          </div>
          <div className="textPreviewBody">
            {texto || <span className="muted">Sua legenda aparece aqui.</span>}
            {tags.length > 0 && `\n\n${tags.map((t) => `#${t}`).join(' ')}`}
          </div>
          {foto ? (
            <img className="previewPhoto" src={mediaUrl(foto)} alt="Foto do post" />
          ) : (
            <button type="button" className="previewPhoto empty" onClick={() => setPicker(true)}>
              <b>Coloque sua foto aqui</b>
              <span>Pode ser qualquer foto sua</span>
            </button>
          )}
        </div>
      </aside>

      {picker && (
        <div className="canvasPicker" role="dialog" aria-modal="true" aria-label="Escolher foto do post">
          <div className="canvasPickerIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <b>Escolha a foto do post</b>
              <button type="button" className="calIconBtn" onClick={() => setPicker(false)} aria-label="Fechar">×</button>
            </div>
            <MediaLibrary
              items={media}
              mode="picker"
              only="imagem"
              selectedId={foto ?? undefined}
              onPick={(m) => {
                setFoto(m.id);
                setPicker(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
