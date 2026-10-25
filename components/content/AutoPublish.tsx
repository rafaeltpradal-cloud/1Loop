'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PostAsset, PostStatus } from '@/lib/contentTypes';
import { cancelSchedule, publishNow, schedulePost } from '@/app/app/conteudos/publish';
import { slotFor } from '@/lib/approve';

export type AutoInfo = { available: boolean; connected: boolean; expiresAt?: string };
export type PublishState = { status: PostStatus; scheduledAt: string | null; externalUrl: string | null; publishError: string | null };

const BR = 'America/Sao_Paulo';
function whenLabel(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('pt-BR', { timeZone: BR, weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('pt-BR', { timeZone: BR, hour: '2-digit', minute: '2-digit' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, às ${time}`;
}
function partsInBrazil(iso: string) {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: BR, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const time = new Intl.DateTimeFormat('pt-BR', { timeZone: BR, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return { date, time };
}

export function AutoPublish({
  postId,
  rede,
  date,
  defaultTime,
  state,
  auto,
  prepareAssets,
  blocker,
  beforeSchedule,
  onChange,
}: {
  postId: number;
  rede: string;
  date: string;
  defaultTime: string;
  state: PublishState;
  auto: AutoInfo;
  prepareAssets: () => Promise<PostAsset[]>;
  /** O que falta no post para a rede aceitar. */
  blocker?: string | null;
  /** Salva edições pendentes antes de agendar. Devolve um erro, se houver. */
  beforeSchedule?: () => Promise<string | null>;
  onChange: (s: PublishState) => void;
}) {
  const router = useRouter();
  // Sem agendamento ainda: dia do calendário no horário da estratégia (ou o próximo dia, se já passou).
  const initial = partsInBrazil(state.scheduledAt ?? slotFor(date, defaultTime).toISOString());
  const [day, setDay] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [busy, setBusy] = useState<'' | 'agendar' | 'agora' | 'cancelar'>('');
  const [confirmNow, setConfirmNow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  if (!auto.available) return null;

  if (!auto.connected) {
    return (
      <div className="autoBox">
        <div>
          <b>Publicação automática no {rede}</b>
          <span className="muted">Conecte o {rede} uma vez e este post sai sozinho no horário que você escolher.</span>
        </div>
        <Link className="btn3d btnSm" href="/app/redes">Conectar {rede}</Link>
      </div>
    );
  }

  async function doSchedule(now: boolean) {
    setError('');
    setBusy(now ? 'agora' : 'agendar');
    try {
      const when = now ? new Date() : new Date(`${day}T${time}:00-03:00`);
      if (Number.isNaN(when.getTime())) throw new Error('Data ou horário inválido.');
      if (!now && when.getTime() < Date.now()) throw new Error('Escolha um horário no futuro.');
      if (beforeSchedule) {
        const err = await beforeSchedule();
        if (err) throw new Error(err);
      }
      const assets = await prepareAssets();
      const res = now ? await publishNow(postId, assets) : await schedulePost(postId, when.toISOString(), assets);
      if (!res.ok) throw new Error(res.error);
      onChange(
        now
          ? { status: 'publicado', scheduledAt: null, externalUrl: res.url ?? null, publishError: null }
          : { status: 'agendado', scheduledAt: when.toISOString(), externalUrl: null, publishError: null },
      );
      setEditing(false);
      setConfirmNow(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não deu certo. Tente de novo.');
    } finally {
      setBusy('');
    }
  }

  async function doCancel() {
    setBusy('cancelar');
    const res = await cancelSchedule(postId);
    setBusy('');
    if (!res.ok) return setError(res.error);
    onChange({ status: 'aprovado', scheduledAt: null, externalUrl: null, publishError: null });
    router.refresh();
  }

  const expiresSoon = auto.expiresAt ? Math.ceil((new Date(auto.expiresAt).getTime() - Date.now()) / 86400000) : null;

  if (state.status === 'publicado') {
    return (
      <div className="autoBox done">
        <div>
          <b>Publicado no {rede}</b>
          <span className="muted">{state.externalUrl ? 'O post já está no ar.' : 'Marcado como publicado.'}</span>
        </div>
        {state.externalUrl && (
          <a className="btnGhost btnSm" href={state.externalUrl} target="_blank" rel="noopener noreferrer">Ver no {rede}</a>
        )}
      </div>
    );
  }

  if (state.status === 'publicando') {
    return (
      <div className="autoBox">
        <div>
          <b>Publicando no {rede}…</b>
          <span className="muted">Atualize a página em instantes.</span>
        </div>
      </div>
    );
  }

  const showForm = state.status !== 'agendado' || editing;

  if (blocker && state.status !== 'agendado') {
    return (
      <div className="autoBox">
        <div>
          <b>Falta um passo para agendar no {rede}</b>
          <span className="muted">{blocker}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={state.status === 'erro' ? 'autoBox err' : 'autoBox'}>
      {state.status === 'agendado' && state.scheduledAt && !editing ? (
        <>
          <div>
            <b>Agendado: {whenLabel(state.scheduledAt)}</b>
            <span className="muted">Sai sozinho no {rede}. Se editar o texto ou as imagens, salve que o agendamento é atualizado.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btnGhost btnSm" onClick={() => setEditing(true)} disabled={!!busy}>Mudar horário</button>
            <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={doCancel} disabled={!!busy}>{busy === 'cancelar' ? 'Cancelando…' : 'Cancelar agendamento'}</button>
          </div>
        </>
      ) : (
        <div>
          <b>{state.status === 'erro' ? 'Não deu para publicar' : `Publicar automaticamente no ${rede}`}</b>
          <span className="muted">{state.status === 'erro' ? state.publishError : state.status === 'rascunho' ? `Aprovou, agendou: o post sai sozinho no ${rede} no dia e horário abaixo.` : 'Escolha o dia e o horário.'}</span>
        </div>
      )}

      {showForm && (
        <div className="autoForm">
          <label className="autoField">
            <span>Dia</span>
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="autoField">
            <span>Horário</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={300} />
          </label>
          <button type="button" className="btn3d btnSm" onClick={() => doSchedule(false)} disabled={!!busy || !day || !time}>
            {busy === 'agendar' ? 'Agendando…' : state.status === 'agendado' ? 'Salvar novo horário' : state.status === 'rascunho' ? 'Aprovar' : state.status === 'erro' ? 'Agendar de novo' : 'Agendar'}
          </button>
          {state.status === 'agendado' && (
            <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => setEditing(false)}>Voltar</button>
          )}
        </div>
      )}

      {showForm &&
        (confirmNow ? (
          <span className="redoConfirm">
            <span className="muted" style={{ fontSize: 13 }}>Publica agora no seu perfil do {rede}.</span>
            <button type="button" className="btnGhost btnSm" onClick={() => doSchedule(true)} disabled={!!busy}>{busy === 'agora' ? 'Publicando…' : 'Confirmar'}</button>
            <button type="button" className="linkBtn" style={{ fontSize: 13 }} onClick={() => setConfirmNow(false)}>Cancelar</button>
          </span>
        ) : (
          <button type="button" className="linkBtn" style={{ fontSize: 13, alignSelf: 'flex-start' }} onClick={() => setConfirmNow(true)} disabled={!!busy}>Publicar agora</button>
        ))}

      {expiresSoon !== null && expiresSoon <= 10 && (
        <span className="muted" style={{ fontSize: 12 }}>
          A conexão com o {rede} vence em {Math.max(0, expiresSoon)} {expiresSoon === 1 ? 'dia' : 'dias'}. <Link href="/app/redes">Reconectar</Link>
        </span>
      )}
      {error && <div role="alert" className="formError">{error}</div>}
    </div>
  );
}
