'use client';

import { useMemo, useState } from 'react';
import { track, trackEvent } from '@/components/Tracking';

type Opt = { label: string; pts: number };
type Q = { id: string; title: string; max: number; opts: Opt[]; tip: string };

const QS: Q[] = [
  { id: 'foto', title: 'Sua foto mostra seu rosto, com boa luz e fundo limpo?', max: 10, opts: [{ label: 'Sim', pts: 10 }, { label: 'Mais ou menos', pts: 5 }, { label: 'Não / sem foto', pts: 0 }], tip: 'Troque a foto: rosto de frente, luz natural, fundo simples. Perfil com foto boa recebe muito mais visitas e respostas.' },
  { id: 'titulo', title: 'O que diz o seu título (a frase abaixo do nome)?', max: 15, opts: [{ label: 'O que eu resolvo e para quem', pts: 15 }, { label: 'Cargo e empresa', pts: 7 }, { label: 'Só o cargo, ou nada', pts: 0 }], tip: 'Reescreva o título: “Ajudo [quem] a [resultado]” vende mais que “Executivo de vendas na X”. É a frase que aparece em todo comentário seu.' },
  { id: 'capa', title: 'Sua imagem de capa (banner) é personalizada?', max: 5, opts: [{ label: 'Sim', pts: 5 }, { label: 'Não, é a padrão', pts: 0 }], tip: 'Use a capa para dizer o que você faz em uma frase. É o espaço mais visto do perfil e quase ninguém aproveita.' },
  { id: 'sobre', title: 'E a seção “Sobre”?', max: 10, opts: [{ label: 'Fala do cliente, com resultado e chamada', pts: 10 }, { label: 'Existe, mas fala só de mim', pts: 5 }, { label: 'Não tenho', pts: 0 }], tip: 'Escreva o “Sobre” para o cliente: o problema dele, como você ajuda, um resultado real e como falar com você.' },
  { id: 'frequencia', title: 'Com que frequência você publica?', max: 20, opts: [{ label: '2 ou mais vezes por semana', pts: 20 }, { label: '1 vez por semana', pts: 14 }, { label: '1 ou 2 vezes por mês', pts: 6 }, { label: 'Quase nunca', pts: 0 }], tip: 'Publique com constância: 2 a 3 posts por semana sobre o dia a dia da sua venda. É o que mais pesa para virar referência, e o que quase todo vendedor abandona.' },
  { id: 'comenta', title: 'Você comenta nos posts de clientes e prospects?', max: 10, opts: [{ label: 'Toda semana', pts: 10 }, { label: 'Às vezes', pts: 5 }, { label: 'Nunca', pts: 0 }], tip: 'Comente 3 posts de clientes por dia, somando uma ideia ou fazendo uma pergunta. Abre mais conversa que mensagem fria.' },
  { id: 'conexoes', title: 'Quantas conexões você tem?', max: 5, opts: [{ label: 'Mais de 1.000', pts: 5 }, { label: '300 a 1.000', pts: 3 }, { label: 'Menos de 300', pts: 1 }], tip: 'Conecte-se toda semana com 20 pessoas do seu público (decisores dos clientes que você quer). Sem rede certa, o post não chega em quem compra.' },
  { id: 'prova', title: 'Tem recomendações ou casos de clientes no perfil?', max: 10, opts: [{ label: '3 ou mais', pts: 10 }, { label: '1 ou 2', pts: 5 }, { label: 'Nenhum', pts: 0 }], tip: 'Peça 3 recomendações a clientes satisfeitos esta semana. Prova social de cliente vale mais que qualquer frase sua.' },
  { id: 'resultado', title: 'O LinkedIn já te trouxe negócio?', max: 15, opts: [{ label: 'Sim, reuniões ou clientes', pts: 15 }, { label: 'Conversas, mas não vendas', pts: 8 }, { label: 'Nada ainda', pts: 0 }], tip: 'Feche o ciclo: todo post termina com um convite leve (comentar, pedir o material, conversar). Sem chamada, a atenção não vira reunião.' },
];

function tier(n: number) {
  if (n >= 90) return { name: 'Referência', desc: 'Seu perfil já trabalha por você. O próximo passo é manter o ritmo sem gastar horas por semana.' };
  if (n >= 70) return { name: 'Quase referência', desc: 'A base está boa. Constância e prova social são o que separa você de ser lembrado primeiro.' };
  if (n >= 40) return { name: 'Presente, mas sem autoridade', desc: 'Você aparece, mas o cliente ainda não te vê como referência. Pequenas mudanças mexem muito nessa nota.' };
  return { name: 'Invisível para quem compra', desc: 'Hoje o cliente olha seu perfil e não encontra motivo para responder. A boa notícia: é a faixa onde cada mudança mais aparece.' };
}

export function ProfileScore() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const q = QS[step];

  const score = useMemo(() => QS.reduce((s, x) => s + (answers[x.id] ?? 0), 0), [answers]);
  const tips = useMemo(
    () =>
      QS.map((x) => ({ x, gap: (x.max - (answers[x.id] ?? 0)) }))
        .filter((t) => t.gap > 0)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3),
    [answers],
  );

  function pick(pts: number) {
    const next = { ...answers, [q.id]: pts };
    setAnswers(next);
    if (step + 1 < QS.length) setStep(step + 1);
    else {
      setDone(true);
      const total = QS.reduce((s, x) => s + (next[x.id] ?? 0), 0);
      track({ ga: 'nota_linkedin', params: { score: total } });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  if (done) {
    const t = tier(score);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <section className="card scoreCard" aria-live="polite">
          <div className="scoreRing" style={{ ['--p' as string]: `${score}` }}>
            <b>{score}</b>
            <span>de 100</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span className="eyebrow">Sua nota</span>
            <h2 style={{ fontSize: 24, letterSpacing: '-0.4px' }}>{t.name}</h2>
            <p className="muted" style={{ fontSize: 15, lineHeight: 1.55 }}>{t.desc}</p>
          </div>
        </section>
        {tips.length > 0 && (
          <section className="card" style={{ padding: 24, boxShadow: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontSize: 18 }}>O que mudar primeiro</h2>
            <ol className="scoreTips">
              {tips.map(({ x, gap }) => (
                <li key={x.id}>
                  <span className="scoreGain">+{gap}</span>
                  <span>{x.tip}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="card scoreCta">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b style={{ fontSize: 18 }}>O que mais pesa na nota é publicar com constância.</b>
            <span className="muted" style={{ fontSize: 15, lineHeight: 1.5 }}>O 1loop monta sua estratégia de 30 dias e escreve os posts na sua voz. Você só revisa e aprova. Comece grátis, sem cartão.</span>
          </div>
          <a className="btn3d" href="/cadastro?plano=pro" onClick={() => trackEvent('cta', 'nota-cadastro')}>Ver minha estratégia grátis</a>
        </section>
        <button
          type="button"
          className="linkBtn"
          style={{ alignSelf: 'flex-start', fontSize: 14 }}
          onClick={() => {
            setAnswers({});
            setStep(0);
            setDone(false);
          }}
        >
          Refazer o teste
        </button>
      </div>
    );
  }

  return (
    <section className="card scoreQ" aria-labelledby="q-title">
      <div className="scoreTop">
        <span className="muted">Pergunta {step + 1} de {QS.length}</span>
        {step > 0 && <button type="button" className="linkBtn" onClick={() => setStep(step - 1)}>Voltar</button>}
      </div>
      <span className="navProgressBar" aria-hidden="true"><span style={{ width: `${(step / QS.length) * 100}%` }} /></span>
      <h2 id="q-title" style={{ fontSize: 21, lineHeight: 1.3, letterSpacing: '-0.3px' }}>{q.title}</h2>
      <div className="scoreOpts">
        {q.opts.map((o) => (
          <button key={o.label} type="button" className={answers[q.id] === o.pts ? 'on' : ''} onClick={() => pick(o.pts)}>{o.label}</button>
        ))}
      </div>
    </section>
  );
}
