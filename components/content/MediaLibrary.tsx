'use client';

import { useRef, useState } from 'react';
import { deleteMedia, registerVideo, setMediaKind, uploadMedia } from '@/app/app/conteudos/media';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { mediaUrl } from '@/lib/scene';
import type { MediaItem } from '@/lib/contentTypes';

type Kind = MediaItem['kind'];

// Reduz a imagem no navegador: JPEG até 1920 px e miniatura até 480 px.
async function prepare(file: File) {
  const bitmap = await createImageBitmap(file);
  const encode = async (max: number, quality: number) => {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('encode');
    return { blob, w, h };
  };
  const full = await encode(1920, 0.86);
  const thumb = await encode(480, 0.8);
  bitmap.close();
  return { full, thumb };
}

const MAX_VIDEO = 50 * 1024 * 1024;

// Lê duração e tamanho do vídeo e tira uma miniatura (JPEG) de um quadro do meio.
async function readVideo(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    // Alguns navegadores não leem MOV/HEVC: aí o vídeo sobe sem miniatura.
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error('timeout')), 8000);
      v.onloadeddata = () => (clearTimeout(t), res());
      v.onerror = () => (clearTimeout(t), rej(new Error('video')));
    });
    const duration = Number.isFinite(v.duration) ? v.duration : 0;
    await new Promise<void>((res) => {
      setTimeout(res, 4000);
      v.onseeked = () => res();
      v.currentTime = Math.min(1, duration / 2 || 0);
    });
    const max = 480;
    const scale = Math.min(1, max / Math.max(v.videoWidth || 1, v.videoHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round((v.videoWidth || 270) * scale));
    canvas.height = Math.max(1, Math.round((v.videoHeight || 480) * scale));
    canvas.getContext('2d')!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const thumb: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    return { width: v.videoWidth, height: v.videoHeight, duration, thumb };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const fmtDur = (s?: number | null) => (s ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : '');

export function MediaLibrary({
  items,
  mode = 'page',
  onPick,
  selectedId,
  only,
}: {
  items: MediaItem[];
  mode?: 'page' | 'picker';
  onPick?: (item: MediaItem) => void;
  selectedId?: number;
  /** No seletor: mostrar só imagens ou só vídeos. */
  only?: 'imagem' | 'video';
}) {
  const [list, setList] = useState(items);
  const [filter, setFilter] = useState<'todas' | Kind>(only === 'video' ? 'video' : mode === 'picker' ? 'foto' : 'todas');
  const [uploadKind, setUploadKind] = useState<Kind>(only === 'video' ? 'video' : 'foto');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function uploadVideos(files: File[]) {
    const supabase = createBrowserSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setError('Sua sessão expirou. Entre de novo.');
    setProgress({ done: 0, total: files.length });
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        if (f.size > MAX_VIDEO) throw new Error('O vídeo pode ter até 50 MB. Exporte em 1080p e tente de novo.');
        const mime = f.type === 'video/quicktime' ? 'video/quicktime' : 'video/mp4';
        const info = await readVideo(f).catch(() => null);
        if (info && info.duration > 0 && (info.duration < 3 || info.duration > 15 * 60)) throw new Error('O reels precisa ter entre 3 segundos e 15 minutos.');
        const base = `${user.id}/v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const path = `${base}.${mime === 'video/quicktime' ? 'mov' : 'mp4'}`;
        const up = await supabase.storage.from('media').upload(path, f, { contentType: mime, upsert: false });
        if (up.error) throw new Error('Não deu para enviar o vídeo. Tente de novo.');
        if (info?.thumb) await supabase.storage.from('media').upload(`${base}.thumb.jpg`, info.thumb, { contentType: 'image/jpeg', upsert: false });
        const res = await registerVideo({ path, mime, size: f.size, width: info?.width ?? 0, height: info?.height ?? 0, duration: info?.duration ?? 0 });
        if (res.ok && res.item) setList((l) => [res.item!, ...l]);
        else if (!res.ok) throw new Error(res.error);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Não deu para enviar o vídeo.');
      }
      setProgress({ done: i + 1, total: files.length });
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    setFilter('video');
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    if (uploadKind === 'video') return uploadVideos(Array.from(files).filter((f) => f.type.startsWith('video/')).slice(0, 5));
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, 20);
    setProgress({ done: 0, total: arr.length });
    for (let i = 0; i < arr.length; i++) {
      try {
        const { full, thumb } = await prepare(arr[i]);
        const fd = new FormData();
        fd.append('foto', new File([full.blob], 'foto.jpg', { type: 'image/jpeg' }));
        fd.append('thumb', new File([thumb.blob], 'thumb.jpg', { type: 'image/jpeg' }));
        fd.append('kind', uploadKind);
        fd.append('width', String(full.w));
        fd.append('height', String(full.h));
        const res = await uploadMedia(fd);
        if (res.ok && res.item) setList((l) => [res.item!, ...l]);
        else if (!res.ok) setError(res.error);
      } catch {
        setError('Não consegui abrir uma das imagens. Use JPG, PNG ou WEBP.');
      }
      setProgress({ done: i + 1, total: arr.length });
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    if (uploadKind !== filter && filter !== 'todas') setFilter(uploadKind);
  }

  async function toggleKind(m: MediaItem) {
    const kind: Kind = m.kind === 'foto' ? 'referencia' : 'foto';
    setList((l) => l.map((x) => (x.id === m.id ? { ...x, kind } : x)));
    const res = await setMediaKind(m.id, kind);
    if (!res.ok) {
      setList((l) => l.map((x) => (x.id === m.id ? m : x)));
      setError(res.error);
    }
  }

  async function remove(id: number) {
    setConfirmDel(null);
    const before = list;
    setList((l) => l.filter((x) => x.id !== id));
    const res = await deleteMedia(id);
    if (!res.ok) {
      setList(before);
      setError(res.error);
    }
  }

  const shown = list.filter((m) => filter === 'todas' || m.kind === filter);
  const count = (k: Kind) => list.filter((m) => m.kind === k).length;

  return (
    <div className="mediaLib">
      <div className="mediaUpload">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <b style={{ fontSize: 15 }}>{uploadKind === 'video' ? 'Enviar vídeos' : 'Enviar imagens'}</b>
          <span className="muted" style={{ fontSize: 13 }}>
            {uploadKind === 'foto'
              ? 'Fotos suas, do produto ou do bastidor para usar nos posts.'
              : uploadKind === 'referencia'
                ? 'Posts que você admira, para a IA se inspirar no estilo.'
                : 'Vídeos verticais para os reels: MP4 ou MOV, até 50 MB.'}
          </span>
        </div>
        {only !== 'video' && (
          <div className="themeSwitch" role="radiogroup" aria-label="Tipo de arquivo">
            <button type="button" role="radio" aria-checked={uploadKind === 'foto'} onClick={() => setUploadKind('foto')}>Fotos</button>
            <button type="button" role="radio" aria-checked={uploadKind === 'referencia'} onClick={() => setUploadKind('referencia')}>Referências</button>
            {only !== 'imagem' && <button type="button" role="radio" aria-checked={uploadKind === 'video'} onClick={() => setUploadKind('video')}>Vídeos</button>}
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept={uploadKind === 'video' ? 'video/mp4,video/quicktime' : 'image/jpeg,image/png,image/webp,image/heic'}
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <button type="button" className="btn3d btnSm" onClick={() => input.current?.click()} disabled={!!progress}>
          {progress ? `Enviando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…` : uploadKind === 'video' ? 'Escolher vídeos' : 'Escolher imagens'}
        </button>
      </div>

      {error && <div role="alert" className="formError">{error}</div>}

      {only !== 'video' && (
        <div className="mediaTabs" role="tablist">
          {mode === 'page' && (
            <button type="button" role="tab" aria-selected={filter === 'todas'} onClick={() => setFilter('todas')}>Todas ({list.length})</button>
          )}
          <button type="button" role="tab" aria-selected={filter === 'foto'} onClick={() => setFilter('foto')}>Fotos ({count('foto')})</button>
          <button type="button" role="tab" aria-selected={filter === 'referencia'} onClick={() => setFilter('referencia')}>Referências ({count('referencia')})</button>
          {only !== 'imagem' && <button type="button" role="tab" aria-selected={filter === 'video'} onClick={() => setFilter('video')}>Vídeos ({count('video')})</button>}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="mediaEmpty">
          <b>{filter === 'referencia' ? 'Nenhuma referência ainda.' : filter === 'video' ? 'Nenhum vídeo ainda.' : 'Nenhuma foto ainda.'}</b>
          <span className="muted">
            {filter === 'referencia'
              ? 'Mande prints de posts que você gostaria de ter feito. A IA usa como inspiração de estrutura e tom.'
              : filter === 'video'
                ? 'Grave na vertical (9:16) seguindo o roteiro do post e envie aqui. Ele vira o reels na hora de publicar.'
                : 'Mande fotos suas, do seu produto ou do seu trabalho. Elas viram fundo das imagens e a IA escreve em cima delas.'}
          </span>
        </div>
      ) : (
        <ul className="mediaGrid">
          {shown.map((m) => (
            <li key={m.id} className={selectedId === m.id ? 'mediaCell on' : 'mediaCell'}>
              <button type="button" className="mediaThumb" onClick={() => onPick?.(m)} disabled={mode !== 'picker'} aria-label={mode === 'picker' ? 'Usar esta imagem' : 'Imagem'}>
                <img src={mediaUrl(m.id, true)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                {m.kind === 'video' && <span className="mediaPlay" aria-hidden="true">▶</span>}
              </button>
              <span className={`mediaBadge ${m.kind}`}>{m.kind === 'foto' ? 'Foto' : m.kind === 'video' ? `Vídeo${m.duration_s ? ` · ${fmtDur(m.duration_s)}` : ''}` : 'Referência'}</span>
              {mode === 'page' && (
                <div className="mediaActions">
                  {confirmDel === m.id ? (
                    <>
                      <button type="button" onClick={() => remove(m.id)}>Apagar</button>
                      <button type="button" onClick={() => setConfirmDel(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      {m.kind !== 'video' && <button type="button" onClick={() => toggleKind(m)}>{m.kind === 'foto' ? 'Virar referência' : 'Virar foto'}</button>}
                      <button type="button" onClick={() => setConfirmDel(m.id)}>Apagar</button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
