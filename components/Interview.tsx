'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { OTHER, QUESTIONS, displayValue, isAnswered, optionsOf, otherKey, type Answers } from '@/lib/interview';
import { VoiceButton } from '@/components/VoiceButton';
import { saveAnswers } from '@/app/app/entrevista/actions';
import { LoopMark } from '@/components/Logo';

const GENERATING_MSGS = [
  'Lendo suas respostas…',
  'Definindo seus pilares de conteúdo…',
  'Montando a série e o ritmo…',
  'Distribuindo 30 dias no calendário…',
  'Escrevendo o plano de ação…',
];
const POST_MSGS = ['Escolhendo o primeiro tema…', 'Escrevendo o gancho…', 'Montando o visual…', 'Revisando na sua voz…'];

// Frases curtas entre as perguntas: dá ritmo e mostra quanto falta.
function cheer(done: number, total: number) {
  const left = total - done;
  if (left === 1) return 'Última pergunta!';
  if (done === Math.ceil(total / 2)) return 'Metade do caminho!';
  if (left <= 3) return `Só mais ${left}!`;
  return '';
}

export function Interview({ initial, hasStrategy, preview = false, firstName = '' }: { initial: Answers; hasStrategy: boolean; preview?: boolean; firstName?: string }) {
  const router = useRouter();
  const firstOpen = Math.max(0, QUESTIONS.findIndex((q) => !isAnswered(q, initial[q.id], initial)));
  const [answers, setAnswers] = useState<Answers>(initial);
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [phase, setPhase] = useState<'asking' | 'generating' | 'post' | 'error'>('asking');
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [toast, setToast] = useState<{ title: string; sub: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
  }, []);
  const [limitMsg, setLimitMsg] = useState('');
  const [msg, setMsg] = useState(0);
  const [, startTransition] = useTransition();

  const q = QUESTIONS[idx];
  const value = answers[q.id];
  const ok = isAnswered(q, value, answers);
  const otherOn = !!q.allowOther && Array.isArray(value) && value.includes(OTHER);
  const otherText = typeof answers[otherKey(q.id)] === 'string' ? (answers[otherKey(q.id)] as string) : '';
  const isLast = idx === QUESTIONS.length - 1;
  const pct = Math.round(((idx + (ok ? 1 : 0)) / QUESTIONS.length) * 100);

  const blocks = useMemo(() => Array.from(new Set(QUESTIONS.map((x) => x.block))), []);

  function setValue(v: string | string[]) {
    setAnswers((a) => ({ ...a, [q.id]: v }));
  }

  function go(to: number) {
    setDir(to < idx ? 'back' : 'fwd');
    setIdx(to);
  }

  function showToast(t: { title: string; sub: string }) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  function setOther(v: string) {
    setAnswers((a) => ({ ...a, [otherKey(q.id)]: v }));
  }

  function toggle(option: string) {
    if (q.kind === 'single') {
      setValue(option);
      // Escolha única: passa sozinho para a próxima, como num jogo.
      if (!(q.allowOther && option === OTHER) && !isLast) {
        if (autoTimer.current) clearTimeout(autoTimer.current);
        const nextAnswers = { ...answers, [q.id]: option };
        autoTimer.current = setTimeout(() => advance(nextAnswers), 320);
      }
      return;
    }
    const cur = Array.isArray(value) ? value : [];
    if (cur.includes(option)) setValue(cur.filter((x) => x !== option));
    else if (cur.length < (q.max ?? 10)) setValue([...cur, option]);
  }

  function advance(current: Answers) {
    startTransition(() => {
      void saveAnswers(current);
    });
    if (isLast) return void generate(current);
    const nq = QUESTIONS[idx + 1];
    const done = idx + 1;
    if (nq.block !== q.block) {
      const left = QUESTIONS.length - done;
      showToast({ title: `${q.block} ✓`, sub: `Bloco concluído · faltam ${left} ${left === 1 ? 'pergunta' : 'perguntas'}` });
    } else {
      const c = cheer(done, QUESTIONS.length);
      if (c) showToast({ title: c, sub: `${done} de ${QUESTIONS.length} respondidas` });
    }
    go(idx + 1);
  }

  function next() {
    advance(answers);
  }

  async function generate(current: Answers = answers) {
    setPhase('generating');
    setMsg(0);
    const timer = setInterval(() => setMsg((m) => m + 1), 2200);
    try {
      await saveAnswers(current, true);
      setLimitMsg('');
      const res = await fetch('/api/estrategia', { method: 'POST' });
      if (res.status === 429) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setLimitMsg(json.error || 'Você chegou ao limite de estratégias deste mês.');
        setPhase('error');
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json().catch(() => ({}))) as { firstIndex?: number | null };
      // Primeira estratégia: já escreve o primeiro post para a pessoa ver o resultado na hora.
      if (!hasStrategy && typeof json.firstIndex === 'number') {
        setPhase('post');
        setMsg(0);
        try {
          const pr = await fetch('/api/conteudos/gerar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: json.firstIndex }) });
          const pj = (await pr.json().catch(() => ({}))) as { post?: { id: number } };
          if (pr.ok && pj.post?.id) {
            router.push(`/app/conteudos/${pj.post.id}?primeiro=1`);
            router.refresh();
            return;
          }
        } catch (err) {
          console.error('[primeiro post]', err);
        }
      }
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
        {phase === 'generating' || phase === 'post' ? (
          <>
            <ol className="genSteps" aria-label="Etapas">
              <li className={phase === 'generating' ? 'on' : 'done'}>{phase === 'post' ? '✓' : '1'} Estratégia de 30 dias</li>
              {!hasStrategy && <li className={phase === 'post' ? 'on' : ''}>2 Seu primeiro post</li>}
            </ol>
            <h2 style={{ fontSize: 26, letterSpacing: '-0.5px' }}>
              <span className="graphite">{phase === 'post' ? `Escrevendo seu primeiro post${firstName ? `, ${firstName}` : ''}` : 'Montando sua estratégia de 30 dias'}</span>
            </h2>
            <p className="muted" role="status" aria-live="polite" style={{ fontSize: 16 }}>
              {phase === 'post' ? POST_MSGS[Math.min(msg, POST_MSGS.length - 1)] : GENERATING_MSGS[Math.min(msg, GENERATING_MSGS.length - 1)]}
            </p>
            <p className="muted" style={{ fontSize: 13 }}>{phase === 'post' ? 'Leva uns 30 segundos.' : 'Leva cerca de 1 minuto. Não feche esta tela.'}</p>
          </>
        ) : (
          <>
            {limitMsg ? (
              <>
                <h2 style={{ fontSize: 24 }}>Suas respostas foram salvas.</h2>
                <p className="muted" style={{ maxWidth: 520, lineHeight: 1.55 }}>{limitMsg}</p>
                <a className="btn3d" href="/app/estrategia">Ver minha estratégia</a>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 24 }}>Não conseguimos gerar a estratégia agora.</h2>
                <p className="muted">Suas respostas estão salvas. Tente de novo em instantes.</p>
                <button className="btn3d" type="button" onClick={() => void generate()}>Tentar de novo</button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="ivWrap">
      <div className="card ivCard">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
            <span>Pergunta {idx + 1} de {QUESTIONS.length}</span>
            <span>{q.block}</span>
          </div>
          <div className="ivSegs" aria-hidden="true">
            {blocks.map((b) => {
              const qs = QUESTIONS.filter((x) => x.block === b);
              const first = QUESTIONS.indexOf(qs[0]);
              const fill = Math.max(0, Math.min(1, (idx + (ok ? 1 : 0) - first) / qs.length));
              return (
                <span key={b} className={fill >= 1 ? 'full' : ''} style={{ flex: qs.length }}>
                  <i style={{ width: `${fill * 100}%` }} />
                </span>
              );
            })}
          </div>
          <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>{pct}% concluído</span>
        </div>

        {toast && (
          <div className="ivToast" role="status" aria-live="polite">
            <b>{toast.title}</b>
            <span>{toast.sub}</span>
          </div>
        )}

        <div key={q.id} className={`ivQ ${dir}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 id={`q-${q.id}`} style={{ fontSize: 26, lineHeight: 1.25, letterSpacing: '-0.5px' }}>{q.title}</h2>
          <p className="muted" style={{ fontSize: 15, lineHeight: 1.55 }}>{q.hint}</p>
        </div>

        {(q.kind === 'single' || q.kind === 'multi') && (
          <div key={`opts-${q.id}`} role="group" aria-labelledby={`q-${q.id}`} className={`ivOpts ${dir}`}>
            {optionsOf(q).map((o) => {
              const pressed = q.kind === 'single' ? value === o : Array.isArray(value) && value.includes(o);
              return (
                <button key={o} type="button" className="chip" aria-pressed={pressed} onClick={() => toggle(o)}>{o}</button>
              );
            })}
          </div>
        )}
        {otherOn && (
          <div className="field rise">
            <label htmlFor={`other-${q.id}`}>Qual outro tema?</label>
            <input id={`other-${q.id}`} type="text" maxLength={120} value={otherText} placeholder="Ex.: Nutrição esportiva, pets, arquitetura" onChange={(e) => setOther(e.target.value)} autoFocus />
            <VoiceButton key={`o-${q.id}`} value={otherText} onChange={setOther} />
          </div>
        )}
        {q.kind === 'multi' && (
          <div className="muted" style={{ fontSize: 13 }}>{Array.isArray(value) ? value.length : 0} de até {q.max} escolhidos</div>
        )}
        {q.kind === 'text' && (
          <div className="field">
            <label htmlFor={`in-${q.id}`} className="sr-only" style={{ position: 'absolute', left: -9999 }}>{q.title}</label>
            <input id={`in-${q.id}`} type="text" value={typeof value === 'string' ? value : ''} placeholder={q.placeholder} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) next(); }} autoFocus />
            <VoiceButton key={q.id} value={typeof value === 'string' ? value : ''} onChange={setValue} />
          </div>
        )}
        {q.kind === 'longtext' && (
          <div className="field">
            <label htmlFor={`in-${q.id}`} style={{ position: 'absolute', left: -9999 }}>{q.title}</label>
            <textarea id={`in-${q.id}`} rows={4} value={typeof value === 'string' ? value : ''} placeholder={q.placeholder} onChange={(e) => setValue(e.target.value)} autoFocus />
            <VoiceButton key={q.id} value={typeof value === 'string' ? value : ''} onChange={setValue} />
          </div>
        )}

        <div className="ivActions">
          <button className="btnGhost" type="button" onClick={() => go(Math.max(0, idx - 1))} disabled={idx === 0}>Voltar</button>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {q.optional && !isLast && (
              <button className="linkBtn" type="button" onClick={next}>Pular</button>
            )}
            <button className="btn3d" type="button" onClick={next} disabled={!ok}>
              {isLast ? (hasStrategy ? 'Gerar nova estratégia' : preview ? 'Ver minha estratégia e meu post' : 'Gerar minha estratégia') : 'Próxima'}
            </button>
          </div>
        </div>
      </div>

      <aside className="card ivAside">
        <div className="eyebrow">Seu perfil de estilo</div>
        {blocks.map((b) => (
          <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-2)', textTransform: 'uppercase', letterSpacing: 1.2 }}>{b}</div>
            {QUESTIONS.filter((x) => x.block === b).map((x) => {
              const i = QUESTIONS.indexOf(x);
              const txt = displayValue(x, answers);
              return (
                <button key={x.id} type="button" onClick={() => go(i)} style={{ textAlign: 'left', background: i === idx ? 'var(--hover)' : 'transparent', border: 0, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', font: 'inherit' }}>
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
