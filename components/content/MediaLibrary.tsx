'use client';

import { useRef, useState } from 'react';
import { deleteMedia, setMediaKind, uploadMedia } from '@/app/app/conteudos/media';
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

export function MediaLibrary({
  items,
  mode = 'page',
  onPick,
  selectedId,
}: {
  items: MediaItem[];
  mode?: 'page' | 'picker';
  onPick?: (item: MediaItem) => void;
  selectedId?: number;
}) {
  const [list, setList] = useState(items);
  const [filter, setFilter] = useState<'todas' | Kind>(mode === 'picker' ? 'foto' : 'todas');
  const [uploadKind, setUploadKind] = useState<Kind>('foto');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError('');
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
          <b style={{ fontSize: 15 }}>Enviar imagens</b>
          <span className="muted" style={{ fontSize: 13 }}>
            {uploadKind === 'foto' ? 'Fotos suas, do produto ou do bastidor para usar nos posts.' : 'Posts que você admira, para a IA se inspirar no estilo.'}
          </span>
        </div>
        <div className="themeSwitch" role="radiogroup" aria-label="Tipo de imagem">
          <button type="button" role="radio" aria-checked={uploadKind === 'foto'} onClick={() => setUploadKind('foto')}>Fotos</button>
          <button type="button" role="radio" aria-checked={uploadKind === 'referencia'} onClick={() => setUploadKind('referencia')}>Referências</button>
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple hidden onChange={(e) => upload(e.target.files)} />
        <button type="button" className="btn3d btnSm" onClick={() => input.current?.click()} disabled={!!progress}>
          {progress ? `Enviando ${Math.min(progress.done + 1, progress.total)} de ${progress.total}…` : 'Escolher imagens'}
        </button>
      </div>

      {error && <div role="alert" className="formError">{error}</div>}

      <div className="mediaTabs" role="tablist">
        {mode === 'page' && (
          <button type="button" role="tab" aria-selected={filter === 'todas'} onClick={() => setFilter('todas')}>Todas ({list.length})</button>
        )}
        <button type="button" role="tab" aria-selected={filter === 'foto'} onClick={() => setFilter('foto')}>Fotos ({count('foto')})</button>
        <button type="button" role="tab" aria-selected={filter === 'referencia'} onClick={() => setFilter('referencia')}>Referências ({count('referencia')})</button>
      </div>

      {shown.length === 0 ? (
        <div className="mediaEmpty">
          <b>{filter === 'referencia' ? 'Nenhuma referência ainda.' : 'Nenhuma foto ainda.'}</b>
          <span className="muted">
            {filter === 'referencia'
              ? 'Mande prints de posts que você gostaria de ter feito. A IA usa como inspiração de estrutura e tom.'
              : 'Mande fotos suas, do seu produto ou do seu trabalho. Elas viram fundo das imagens e a IA escreve em cima delas.'}
          </span>
        </div>
      ) : (
        <ul className="mediaGrid">
          {shown.map((m) => (
            <li key={m.id} className={selectedId === m.id ? 'mediaCell on' : 'mediaCell'}>
              <button type="button" className="mediaThumb" onClick={() => onPick?.(m)} disabled={mode !== 'picker'} aria-label={mode === 'picker' ? 'Usar esta imagem' : 'Imagem'}>
                <img src={mediaUrl(m.id, true)} alt="" loading="lazy" />
              </button>
              <span className={`mediaBadge ${m.kind}`}>{m.kind === 'foto' ? 'Foto' : 'Referência'}</span>
              {mode === 'page' && (
                <div className="mediaActions">
                  {confirmDel === m.id ? (
                    <>
                      <button type="button" onClick={() => remove(m.id)}>Apagar</button>
                      <button type="button" onClick={() => setConfirmDel(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => toggleKind(m)}>{m.kind === 'foto' ? 'Virar referência' : 'Virar foto'}</button>
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
