'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { removeAvatar, uploadAvatar } from './avatar';

// Recorta no centro, deixa quadrada e reduz para 400 px antes de enviar.
async function prepare(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const size = Math.min(400, side);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('canvas');
    c.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.88));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AvatarUploader({ name, url }: { name: string; url: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    if (!file.type.startsWith('image/')) return setError('Escolha uma imagem.');
    start(async () => {
      try {
        const blob = await prepare(file);
        const fd = new FormData();
        fd.append('foto', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        const res = await uploadAvatar(fd);
        if (!res.ok) setError(res.message ?? 'Não deu certo.');
        else router.refresh();
      } catch {
        setError('Não consegui ler essa imagem. Tente outra.');
      } finally {
        if (input.current) input.current.value = '';
      }
    });
  }

  function remove() {
    start(async () => {
      await removeAvatar();
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative' }}>
        <Avatar name={name} url={url} size={72} />
        {pending && <span className="spinner" style={{ position: 'absolute', inset: 18, width: 36, height: 36 }} aria-label="Enviando" />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btnGhost btnSm" onClick={() => input.current?.click()} disabled={pending}>
            {url ? 'Trocar foto' : 'Enviar foto'}
          </button>
          {url && (
            <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={remove} disabled={pending}>Remover</button>
          )}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>JPG, PNG ou WEBP. A gente recorta em quadrado.</span>
        {error && <span role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--error-ink)' }}>{error}</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
