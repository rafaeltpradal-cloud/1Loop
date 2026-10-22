'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { QUESTIONS, isAnswered, type Answers } from '@/lib/interview';
import { saveAnswers } from '@/app/app/entrevista/actions';
import { LoopMark } from '@/components/Logo';

const GENERATING_MSGS = [
  'Lendo suas respostas…',
  'Definindo seus pilares de conteúdo…',
  'Montando a série e o ritmo…',
  'Distribuindo 30 dias no calendário…',
  'Escrevendo o plano de ação…',
];

export function Interview({ initial, hasStrategy }: { initial: Answers; hasStrategy: boolean }) {
  const router = useRouter();
  const firstOpen = Math.max(0, QUESTIONS.findIndex((q) => !isAnswered(q, initial[q.id])));
  const [answers, setAnswers] = useState<Answers>(initial);
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [phase, setPhase] = useState<'asking' | 'generating' | 'error'>('asking');
  const [msg, setMsg] = useState(0);
  const [, startTransition] = useTransition();

  const q = QUESTIONS[idx];
  const value = answers[q.id];
  const ok = isAnswered(q, value);
  const isLast = idx === QUESTIONS.length - 1;
  const pct = Math.round(((idx + (ok ? 1 : 0)) / QUESTIONS.length) * 100);

  const blocks = useMemo(() => Array.from(new Set(QUESTIONS.map((x) => x.block))), []);

  function setValue(v: string | string[]) {
    setAnswers((a) => ({ ...a, [q.id]: v }));
  }

  function toggle(option: string) {
    if (q.kind === 'single') return setValue(option);
    const cur = Array.isArray(value) ? value : [];
    if (cur.includes(option)) setValue(cur.filter((x) => x !== option));
    else if (cur.length < (q.max ?? 10)) setValue([...cur, option]);
  }

  function next() {
    startTransition(() => {
      void saveAnswers(answers);
    });
    if (!isLast) setIdx(idx + 1);
    else void generate();
  }

  async function generate() {
    setPhase('generating');
    const timer = setInterval(() => setMsg((m) => (m + 1) % GENERATING_MSGS.length), 2200);
    try {
      await saveAnswers(answers, true);
      const res = await fetch('/api/estrategia', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      router.push('/app/estrategia');
      router.refresh();
    } catch (err) {
      console.error(err);
      setPhase('error');
    } finally {
      clearInterval(timer);
    }
  }

  if (phase !== 'asking') {
    return (
      <div className="card rise" style={{ padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
        <LoopMark size={96} stroke={1.6} />
        {phase === 'generating' ? (
          <>
            <h2 style={{ fontSize: 26, letterSpacing: '-0.5px' }}><span className="graphite">Montando sua estratégia de 30 dias</span></h2>
            <p className="muted" role="status" aria-live="polite" style={{ fontSize: 16 }}>{GENERATING_MSGS[msg]}</p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 24 }}>Não conseguimos gerar a estratégia agora.</h2>
            <p className="muted">Suas respostas estão salvas. Tente de novo em instantes.</p>
            <button className="btn3d" type="button" onClick={() => void generate()}>Tentar de novo</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
      <div className="card" style={{ flex: '999 1 560px', minWidth: 0, padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            <span>Pergunta {idx + 1} de {QUESTIONS.length}</span>
            <span>{q.block}</span>
          </div>
          <div className="progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        </div>

        <div key={q.id} className="rise" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id={`q-${q.id}`} style={{ fontSize: 26, lineHeight: 1.25, letterSpacing: '-0.5px' }}>{q.title}</h2>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.55 }}>{q.hint}</p>
        </div>

        {(q.kind === 'single' || q.kind === 'multi') && (
          <div role="group" aria-labelledby={`q-${q.id}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {q.options!.map((o) => {
              const pressed = q.kind === 'single' ? value === o : Array.isArray(value) && value.includes(o);
              return (
                <button key={o} type="button" className="chip" aria-pressed={pressed} onClick={() => toggle(o)}>{o}</button>
              );
            })}
          </div>
        )}
        {q.kind === 'multi' && (
          <div className="muted" style={{ fontSize: 13 }}>{Array.isArray(value) ? value.length : 0} de até {q.max} escolhidos</div>
        )}
        {q.kind === 'text' && (
          <div className="field">
            <label htmlFor={`in-${q.id}`} className="sr-only" style={{ position: 'absolute', left: -9999 }}>{q.title}</label>
            <input id={`in-${q.id}`} type="text" value={typeof value === 'string' ? value : ''} placeholder={q.placeholder} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) next(); }} autoFocus />
          </div>
        )}
        {q.kind === 'longtext' && (
          <div className="field">
            <label htmlFor={`in-${q.id}`} style={{ position: 'absolute', left: -9999 }}>{q.title}</label>
            <textarea id={`in-${q.id}`} rows={4} value={typeof value === 'string' ? value : ''} placeholder={q.placeholder} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button className="btnGhost btnSm" type="button" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>Voltar</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {q.optional && !isLast && (
              <button className="linkBtn" type="button" onClick={next}>Pular</button>
            )}
            <button className="btn3d" type="button" onClick={next} disabled={!ok}>
              {isLast ? (hasStrategy ? 'Gerar nova estratégia' : 'Gerar minha estratégia') : 'Próxima'}
            </button>
          </div>
        </div>
      </div>

      <aside className="card" style={{ flex: '1 1 280px', minWidth: 0, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'none' }}>
        <div className="eyebrow">Seu perfil de voz</div>
        {blocks.map((b) => (
          <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: 1.2 }}>{b}</div>
            {QUESTIONS.filter((x) => x.block === b).map((x) => {
              const i = QUESTIONS.indexOf(x);
              const v = answers[x.id];
              const txt = Array.isArray(v) ? v.join(', ') : v;
              return (
                <button key={x.id} type="button" onClick={() => setIdx(i)} style={{ textAlign: 'left', background: i === idx ? '#F4F5F7' : 'transparent', border: 0, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', font: 'inherit' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>{x.title}</div>
                  <div style={{ fontSize: 13, color: txt ? 'var(--ink)' : 'var(--muted-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txt || (x.optional ? 'Opcional' : 'Ainda não respondido')}</div>
                </button>
              );
            })}
          </div>
        ))}
      </aside>
    </div>
  );
}
