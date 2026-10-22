'use client';

import { useEffect, useRef, useState } from 'react';

// Ditado por voz usando o reconhecimento de fala do próprio navegador (Chrome, Edge, Safari).
// O texto falado entra no campo e a pessoa pode corrigir antes de seguir.

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceButton({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const recRef = useRef<Recognition | null>(null);
  const baseRef = useRef('');

  useEffect(() => {
    setSupported(!!getCtor());
    return () => recRef.current?.stop();
  }, []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError('');
    baseRef.current = value.trim();
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = '';
      let partial = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else partial += r[0].transcript;
      }
      if (finalText.trim()) {
        baseRef.current = [baseRef.current, finalText.trim()].filter(Boolean).join(' ');
        onChange(baseRef.current);
      }
      setInterim(partial);
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Libere o microfone no navegador para responder em áudio.');
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Não consegui ouvir. Tente de novo.');
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
  }

  if (!supported) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={listening ? 'micBtn on' : 'micBtn'}
          onClick={listening ? stop : start}
          aria-pressed={listening}
        >
          <span className="micDot" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </span>
          {listening ? 'Parar gravação' : 'Responder em áudio'}
        </button>
        {listening && (
          <span className="muted" role="status" aria-live="polite" style={{ fontSize: 13 }}>
            Ouvindo… fale à vontade e toque em parar quando terminar.
          </span>
        )}
      </div>
      {listening && interim && <div className="muted" style={{ fontSize: 14, fontStyle: 'italic' }}>{interim}</div>}
      {error && <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: 'var(--error-ink)' }}>{error}</div>}
    </div>
  );
}
