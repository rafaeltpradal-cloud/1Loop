'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaLibrary } from '@/components/content/MediaLibrary';
import { brandFont, measureCtx, type ImageSpec } from '@/lib/postImage';
import { boundsOf, drawScene, loadMedia, newId, type ImageLayer, type Layer, type Scene, type TextLayer } from '@/lib/scene';
import type { MediaItem, PostContent } from '@/lib/contentTypes';

const SWATCHES = ['#FFFFFF', '#F5F5F2', '#0E0F12', '#121211', '#5E646C', '#FFD640', '#3B6CF6', '#7C4DFF', '#E0458F', '#F08A24', '#12A594', 'brand'];
const BG_SWATCHES = ['#FFFFFF', '#F7F7F5', '#121211', '#0E0F12', '#1E2A5A', '#3B6CF6', '#7C4DFF', '#E0458F', '#F08A24', '#12A594', 'brand'];
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

type Props = {
  specs: ImageSpec[];
  content: PostContent;
  media: MediaItem[];
  startIndex: number;
  onCancel: () => void;
  onApply: (canvas: Record<string, Scene>) => void;
};

function Swatch({ value, active, onPick, label }: { value: string; active: boolean; onPick: () => void; label: string }) {
  return (
    <button
      type="button"
      className={active ? 'swatch on' : 'swatch'}
      style={{ background: value === 'brand' ? 'linear-gradient(90deg,#3B6CF6,#7C4DFF,#E0458F,#F08A24)' : value }}
      onClick={onPick}
      aria-label={label}
      aria-pressed={active}
    />
  );
}

export function CanvasEditor({ specs, content, media, startIndex, onCancel, onApply }: Props) {
  const [scenes, setScenes] = useState<Record<string, Scene> | null>(null);
  const [idx, setIdx] = useState(startIndex);
  const [sel, setSel] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [picker, setPicker] = useState<null | 'add' | 'replace' | 'fundo'>(null);
  const [font, setFont] = useState('sans-serif');
  const [, setTick] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<null | { mode: 'move' | 'resize'; id: string; sx: number; sy: number; orig: Layer }>(null);
  const images = useRef(new Map<number, HTMLImageElement>());

  const spec = specs[idx];
  const scene = scenes?.[spec.key];
  const layer = scene?.layers.find((l) => l.id === sel) ?? null;

  // Monta as cenas: a editada antes ou o modelo.
  useEffect(() => {
    (async () => {
      const f = await brandFont();
      setFont(f);
      const out: Record<string, Scene> = {};
      for (const s of specs) out[s.key] = clone(content.canvas?.[s.key] ?? s.build(measureCtx(), f));
      setScenes(out);
    })();
  }, [specs, content.canvas]);

  // Carrega as fotos usadas nas cenas.
  useEffect(() => {
    if (!scene) return;
    const ids = scene.layers.filter((l): l is ImageLayer => l.type === 'image').map((l) => l.media);
    ids.forEach((id) => {
      if (images.current.has(id)) return;
      loadMedia(id).then((img) => {
        if (img) {
          images.current.set(id, img);
          setTick((t) => t + 1);
        }
      });
    });
  }, [scene]);

  // Desenha a cena e a seleção.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !scene) return;
    cv.width = scene.w;
    cv.height = scene.h;
    const ctx = cv.getContext('2d')!;
    drawScene(ctx, scene, font, images.current);
    if (layer) {
      const b = boundsOf(ctx, layer, font);
      const k = scene.w / (cv.getBoundingClientRect().width || scene.w);
      ctx.save();
      ctx.strokeStyle = '#7C4DFF';
      ctx.lineWidth = 2.5 * k;
      ctx.setLineDash([10 * k, 6 * k]);
      ctx.strokeRect(b.x - 6 * k, b.y - 6 * k, b.w + 12 * k, b.h + 12 * k);
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#7C4DFF';
      const hs = 18 * k;
      ctx.fillRect(b.x + b.w + 6 * k - hs / 2, b.y + b.h + 6 * k - hs / 2, hs, hs);
      ctx.strokeRect(b.x + b.w + 6 * k - hs / 2, b.y + b.h + 6 * k - hs / 2, hs, hs);
      ctx.restore();
    }
  });

  const commit = useCallback(
    (mut: (s: Scene) => void, record = true) => {
      setScenes((prev) => {
        if (!prev) return prev;
        if (record) setHistory((h) => [...h.slice(-40), JSON.stringify(prev)]);
        const next = { ...prev, [spec.key]: clone(prev[spec.key]) };
        mut(next[spec.key]);
        return next;
      });
    },
    [spec.key],
  );

  const update = (patch: Partial<Layer>, record = true) =>
    commit((s) => {
      const i = s.layers.findIndex((l) => l.id === sel);
      if (i >= 0) s.layers[i] = { ...s.layers[i], ...patch } as Layer;
    }, record);

  function undo() {
    setHistory((h) => {
      if (!h.length) return h;
      setScenes(JSON.parse(h[h.length - 1]));
      return h.slice(0, -1);
    });
  }

  // ----- ponteiro: selecionar, arrastar, redimensionar -----
  function toScene(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    const k = scene!.w / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  }

  function onDown(e: React.PointerEvent) {
    if (!scene) return;
    const { x, y, k } = toScene(e);
    const ctx = measureCtx();
    if (layer) {
      const b = boundsOf(ctx, layer, font);
      const hx = b.x + b.w + 6 * k;
      const hy = b.y + b.h + 6 * k;
      if (Math.abs(x - hx) < 26 * k && Math.abs(y - hy) < 26 * k) {
        drag.current = { mode: 'resize', id: layer.id, sx: x, sy: y, orig: clone(layer) };
        setHistory((h) => [...h.slice(-40), JSON.stringify(scenes)]);
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }
    for (let i = scene.layers.length - 1; i >= 0; i--) {
      const l = scene.layers[i];
      const b = boundsOf(ctx, l, font);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        setSel(l.id);
        drag.current = { mode: 'move', id: l.id, sx: x, sy: y, orig: clone(l) };
        setHistory((h) => [...h.slice(-40), JSON.stringify(scenes)]);
        canvasRef.current!.setPointerCapture(e.pointerId);
        return;
      }
    }
    setSel(null);
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !scene) return;
    const { x, y } = toScene(e);
    const dx = x - d.sx;
    const dy = y - d.sy;
    commit((s) => {
      const i = s.layers.findIndex((l) => l.id === d.id);
      if (i < 0) return;
      const o = d.orig;
      if (d.mode === 'move') s.layers[i] = { ...s.layers[i], x: Math.round(o.x + dx), y: Math.round(o.y + dy) } as Layer;
      else if (o.type === 'text') s.layers[i] = { ...s.layers[i], w: Math.max(60, Math.round(o.w + dx)) } as Layer;
      else s.layers[i] = { ...s.layers[i], w: Math.max(20, Math.round(o.w + dx)), h: Math.max(20, Math.round(o.h + dy)) } as Layer;
    }, false);
  }

  function onUp() {
    drag.current = null;
  }

  // ----- teclado -----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
      } else if (sel && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        commit((s) => {
          s.layers = s.layers.filter((l) => l.id !== sel);
        });
        setSel(null);
      } else if (sel && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        commit((s) => {
          const i = s.layers.findIndex((l) => l.id === sel);
          if (i >= 0) s.layers[i] = { ...s.layers[i], x: s.layers[i].x + dx, y: s.layers[i].y + dy } as Layer;
        });
      } else if (e.key === 'Escape') setSel(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ----- ações -----
  function addText() {
    if (!scene) return;
    const t: TextLayer = { id: newId(), type: 'text', x: scene.w * 0.1, y: scene.h * 0.42, w: scene.w * 0.8, text: 'Seu texto aqui', size: 64, weight: 800, color: scene.bg === '#F7F7F5' || scene.bg === '#FFFFFF' ? '#0E0F12' : '#FFFFFF', align: 'center', lh: 1.15 };
    commit((s) => s.layers.push(t));
    setSel(t.id);
  }

  function pickMedia(m: MediaItem) {
    if (!scene) return;
    const ratio = m.width && m.height ? m.height / m.width : 1;
    if (picker === 'replace' && layer?.type === 'image') update({ media: m.id } as Partial<ImageLayer>);
    else if (picker === 'fundo') {
      const img: ImageLayer = { id: newId(), type: 'image', x: 0, y: 0, w: scene.w, h: scene.h, media: m.id, fit: 'cover' };
      commit((s) => {
        s.layers = s.layers.filter((l) => !(l.type === 'image' && l.x <= 0 && l.y <= 0 && l.w >= s.w && l.h >= s.h));
        s.layers.unshift(img, { id: newId(), type: 'rect', x: 0, y: s.h * 0.28, w: s.w, h: s.h * 0.72, fill: 'shade' });
      });
      setSel(img.id);
    } else {
      const w = scene.w * 0.6;
      const img: ImageLayer = { id: newId(), type: 'image', x: (scene.w - w) / 2, y: scene.h * 0.25, w, h: Math.round(w * ratio), media: m.id, fit: 'cover', radius: 24 };
      commit((s) => s.layers.push(img));
      setSel(img.id);
    }
    setPicker(null);
  }

  function reorder(dir: 1 | -1) {
    commit((s) => {
      const i = s.layers.findIndex((l) => l.id === sel);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.layers.length) return;
      [s.layers[i], s.layers[j]] = [s.layers[j], s.layers[i]];
    });
  }

  function duplicate() {
    if (!layer) return;
    const copy = { ...clone(layer), id: newId(), x: layer.x + 30, y: layer.y + 30 };
    commit((s) => s.layers.push(copy));
    setSel(copy.id);
  }

  function remove() {
    commit((s) => {
      s.layers = s.layers.filter((l) => l.id !== sel);
    });
    setSel(null);
  }

  function resetSlide() {
    commit((s) => {
      const fresh = spec.build(measureCtx(), font);
      s.layers = fresh.layers;
      s.bg = fresh.bg;
      s.glow = fresh.glow;
    });
    setSel(null);
  }

  if (!scenes || !scene) {
    return (
      <div className="canvasModal" role="dialog" aria-modal="true" aria-label="Editor visual">
        <div className="spinner" style={{ margin: 'auto' }} />
      </div>
    );
  }

  return (
    <div className="canvasModal" role="dialog" aria-modal="true" aria-label="Editor visual">
      <div className="canvasTop">
        <b style={{ fontSize: 16 }}>Editor visual</b>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btnGhost btnSm" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn3d btnSm" onClick={() => onApply(scenes)}>Aplicar</button>
        </div>
      </div>

      <div className="canvasBody">
        <div className="canvasStageWrap">
          {specs.length > 1 && (
            <div className="canvasSlides">
              {specs.map((s, i) => (
                <button key={s.key} type="button" className={i === idx ? 'on' : ''} onClick={() => { setIdx(i); setSel(null); }}>{i + 1}</button>
              ))}
            </div>
          )}
          <div className="canvasStage" style={{ aspectRatio: `${scene.w} / ${scene.h}`, ['--ar' as string]: scene.w / scene.h } as React.CSSProperties}>
            <canvas
              ref={canvasRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              style={{ touchAction: 'none' }}
              aria-label="Toque em um elemento para selecionar; arraste para mover; puxe o quadradinho para redimensionar"
            />
          </div>
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>Toque para selecionar, arraste para mover e puxe o quadradinho para mudar o tamanho.</span>
        </div>

        <aside className="canvasPanel">
          <div className="canvasTools">
            <button type="button" onClick={addText}>+ Texto</button>
            <button type="button" onClick={() => setPicker('add')}>+ Foto</button>
            <button type="button" onClick={() => setPicker('fundo')}>Foto de fundo</button>
            <button type="button" onClick={undo} disabled={!history.length}>Desfazer</button>
            <button type="button" onClick={resetSlide}>Restaurar modelo</button>
          </div>

          {!layer && (
            <div className="canvasGroup">
              <label>Cor de fundo</label>
              <div className="swatches">
                {BG_SWATCHES.map((c) => (
                  <Swatch key={c} value={c} label={`Fundo ${c}`} active={scene.bg === c} onPick={() => commit((s) => { s.bg = c; s.glow = false; })} />
                ))}
                <input type="color" aria-label="Outra cor de fundo" value={isHex(scene.bg) ? scene.bg : '#000000'} onChange={(e) => commit((s) => { s.bg = e.target.value; s.glow = false; }, false)} />
              </div>
              <span className="muted" style={{ fontSize: 12 }}>Selecione um texto, foto ou forma na imagem para editar.</span>
            </div>
          )}

          {layer?.type === 'text' && (
            <>
              <div className="canvasGroup">
                <label htmlFor="cv-text">Texto</label>
                <textarea id="cv-text" rows={3} value={layer.text} onChange={(e) => update({ text: e.target.value }, false)} onFocus={() => setHistory((h) => [...h.slice(-40), JSON.stringify(scenes)])} />
              </div>
              <div className="canvasGroup">
                <label htmlFor="cv-size">Tamanho · {Math.round(layer.size)}</label>
                <input id="cv-size" type="range" min={12} max={220} value={layer.size} onChange={(e) => update({ size: Number(e.target.value) }, false)} />
              </div>
              <div className="canvasGroup">
                <label>Estilo</label>
                <div className="segRow">
                  <button type="button" aria-pressed={layer.weight < 700} onClick={() => update({ weight: 600 })}>Normal</button>
                  <button type="button" aria-pressed={layer.weight >= 700} onClick={() => update({ weight: 800 })}>Negrito</button>
                  <button type="button" aria-pressed={layer.align === 'left'} onClick={() => update({ align: 'left' })} aria-label="Alinhar à esquerda">Esq.</button>
                  <button type="button" aria-pressed={layer.align === 'center'} onClick={() => update({ align: 'center' })} aria-label="Centralizar">Centro</button>
                  <button type="button" aria-pressed={layer.align === 'right'} onClick={() => update({ align: 'right' })} aria-label="Alinhar à direita">Dir.</button>
                </div>
              </div>
              <div className="canvasGroup">
                <label>Cor do texto</label>
                <div className="swatches">
                  {SWATCHES.map((c) => (
                    <Swatch key={c} value={c} label={`Cor ${c}`} active={layer.color === c} onPick={() => update({ color: c })} />
                  ))}
                  <input type="color" aria-label="Outra cor" value={isHex(layer.color) ? layer.color : '#000000'} onChange={(e) => update({ color: e.target.value }, false)} />
                </div>
              </div>
              <div className="canvasGroup">
                <label htmlFor="cv-hi">Destaque (copie um trecho do texto)</label>
                <input id="cv-hi" value={layer.hi ?? ''} onChange={(e) => update({ hi: e.target.value || undefined, hiStyle: layer.hiStyle ?? 'box' }, false)} placeholder="ex.: pedido de socorro" />
                <div className="segRow">
                  <button type="button" aria-pressed={layer.hiStyle === 'box'} onClick={() => update({ hiStyle: 'box' })}>Marca-texto</button>
                  <button type="button" aria-pressed={layer.hiStyle === 'gradient'} onClick={() => update({ hiStyle: 'gradient' })}>Degradê</button>
                </div>
              </div>
              <div className="canvasGroup">
                <label>Fundo do texto</label>
                <div className="swatches">
                  <button type="button" className={!layer.bg ? 'swatch none on' : 'swatch none'} onClick={() => update({ bg: undefined })} aria-label="Sem fundo">∅</button>
                  {['#FFFFFF', '#0E0F12', '#FFD640', '#7C4DFF', 'brand'].map((c) => (
                    <Swatch key={c} value={c} label={`Fundo do texto ${c}`} active={layer.bg === c} onPick={() => update({ bg: c, pad: layer.pad ?? 20, radius: layer.radius ?? 14, bgMode: layer.bgMode ?? 'fit' })} />
                  ))}
                </div>
              </div>
              <div className="canvasGroup">
                <label htmlFor="cv-lh">Espaço entre linhas · {layer.lh.toFixed(2)}</label>
                <input id="cv-lh" type="range" min={0.9} max={1.8} step={0.02} value={layer.lh} onChange={(e) => update({ lh: Number(e.target.value) }, false)} />
              </div>
            </>
          )}

          {layer?.type === 'image' && (
            <>
              <div className="canvasGroup">
                <label>Foto</label>
                <div className="segRow">
                  <button type="button" onClick={() => setPicker('replace')}>Trocar foto</button>
                  <button type="button" aria-pressed={layer.fit === 'cover'} onClick={() => update({ fit: 'cover' })}>Preencher</button>
                  <button type="button" aria-pressed={layer.fit === 'contain'} onClick={() => update({ fit: 'contain' })}>Inteira</button>
                </div>
              </div>
              <div className="canvasGroup">
                <label htmlFor="cv-rad">Cantos · {Math.round(layer.radius ?? 0)}</label>
                <input id="cv-rad" type="range" min={0} max={200} value={layer.radius ?? 0} onChange={(e) => update({ radius: Number(e.target.value) }, false)} />
              </div>
            </>
          )}

          {layer?.type === 'rect' && (
            <>
              <div className="canvasGroup">
                <label>Cor da forma</label>
                <div className="swatches">
                  {[...SWATCHES, 'shade'].map((c) => (
                    <Swatch key={c} value={c === 'shade' ? 'linear-gradient(180deg,transparent,#000)' : c} label={c === 'shade' ? 'Sombra' : `Cor ${c}`} active={layer.fill === c} onPick={() => update({ fill: c })} />
                  ))}
                </div>
              </div>
              <div className="canvasGroup">
                <label htmlFor="cv-rr">Cantos · {Math.round(layer.radius ?? 0)}</label>
                <input id="cv-rr" type="range" min={0} max={200} value={layer.radius ?? 0} onChange={(e) => update({ radius: Number(e.target.value) }, false)} />
              </div>
            </>
          )}

          {layer && (
            <div className="canvasTools">
              <button type="button" onClick={() => reorder(1)}>Para frente</button>
              <button type="button" onClick={() => reorder(-1)}>Para trás</button>
              <button type="button" onClick={duplicate}>Duplicar</button>
              <button type="button" className="danger" onClick={remove}>Excluir</button>
            </div>
          )}
        </aside>
      </div>

      {picker && (
        <div className="canvasPicker" role="dialog" aria-label="Escolher foto">
          <div className="canvasPickerIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <b>{picker === 'fundo' ? 'Escolha a foto de fundo' : picker === 'replace' ? 'Trocar a foto' : 'Adicionar uma foto'}</b>
              <button type="button" className="calIconBtn" onClick={() => setPicker(null)} aria-label="Fechar">×</button>
            </div>
            <MediaLibrary items={media} mode="picker" onPick={pickMedia} />
          </div>
        </div>
      )}
    </div>
  );
}
