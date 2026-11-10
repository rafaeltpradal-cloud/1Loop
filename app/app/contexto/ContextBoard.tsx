'use client';

import { useState, useTransition } from 'react';
import { CONTEXT_TYPES, contextLabel, type ContextItem } from '@/lib/userContext';
import { newMcpLink, removeContext, revokeMcpLink, saveContext } from './actions';

type Link = { id: number; hint: string; created_at: string; last_used_at: string | null } | null;

const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });

const STARTER = 'Me entreviste por uns 10 minutos sobre o meu trabalho (resultados, clientes, opiniões, histórias, oferta e público). A cada resposta útil, salve na 1loop com add_context. No fim, me mostre o que salvou.';

export function ContextBoard({ items: initial, link }: { items: ContextItem[]; link: Link }) {
  const [items, setItems] = useState(initial);
  const [tipo, setTipo] = useState<string>('numero');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState('');
  const [tab, setTab] = useState<'claude' | 'chatgpt' | 'dev'>('claude');

  const hint = CONTEXT_TYPES.find((t) => t.id === tipo)?.dica ?? '';

  function add(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await saveContext({ tipo, titulo, texto });
      if (!r.ok) return setMsg({ kind: 'error', text: r.error });
      setItems((prev) => [r.item, ...prev]);
      setTitulo('');
      setTexto('');
      setMsg({ kind: 'ok', text: 'Salvo. Os próximos posts já usam isso.' });
      setTimeout(() => setMsg(null), 2500);
    });
  }

  function remove(id: number) {
    start(async () => {
      const r = await removeContext(id);
      if (r.ok) setItems((prev) => prev.filter((i) => i.id !== id));
    });
  }

  function gen() {
    start(async () => {
      const r = await newMcpLink();
      if (!r.ok) return setMsg({ kind: 'error', text: r.error });
      setUrl(r.url);
    });
  }

  async function copy(t: string, k: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(k);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      // sem permissão de área de transferência: a pessoa copia à mão
    }
  }

  const devJson = JSON.stringify({ mcpServers: { '1loop': { type: 'http', url: url || 'https://…/api/mcp/SEU_LINK' } } }, null, 2);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Conectar IA */}
      <section className="panel" aria-labelledby="ia-h" style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2 id="ia-h" style={{ margin: 0, fontSize: 19 }}>Conecte a sua IA à 1loop</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>
            Use o Claude, o ChatGPT ou o Cursor para contar sobre o seu trabalho: a IA salva aqui os fatos, números e histórias, lê sua estratégia e reescreve posts da 1loop.
          </p>
        </div>

        {url ? (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="formNote" style={{ fontWeight: 500 }}>Seu link de conexão (só aparece agora; guarde como uma senha):</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ flex: '1 1 320px', fontFamily: 'var(--font-mono, monospace)', fontSize: 13 }} aria-label="Link de conexão" />
              <button type="button" className="btn3d btnSm" onClick={() => copy(url, 'url')}>{copied === 'url' ? 'Copiado ✓' : 'Copiar link'}</button>
            </div>
          </div>
        ) : link ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 14 }}>
            <span className="dot" style={{ background: 'var(--teal)' }} />
            <span>
              Link ativo (termina em <b>…{link.hint}</b>), criado em {fmt(link.created_at)}
              {link.last_used_at ? ` · último uso em ${fmt(link.last_used_at)}` : ' · ainda não usado'}
            </span>
            <button type="button" className="btnGhost btnSm" onClick={gen} disabled={pending}>Gerar novo link</button>
            <button type="button" className="linkBtn" onClick={() => start(async () => void (await revokeMcpLink()))} disabled={pending}>Desconectar</button>
          </div>
        ) : (
          <div>
            <button type="button" className="btn3d" onClick={gen} disabled={pending}>Gerar link de conexão</button>
          </div>
        )}

        <div className="contentTabs" role="tablist" aria-label="Onde conectar">
          {(['claude', 'chatgpt', 'dev'] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} aria-current={tab === k ? 'page' : undefined} onClick={() => setTab(k)} className="linkBtn" style={{ fontWeight: tab === k ? 800 : 600 }}>
              {k === 'claude' ? 'Claude' : k === 'chatgpt' ? 'ChatGPT' : 'Cursor / Claude Code'}
            </button>
          ))}
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6, fontSize: 14.5 }}>
          {tab === 'claude' && (
            <>
              <li>Gere e copie o link acima.</li>
              <li>No Claude (site ou app), abra <b>Configurações › Conectores › Adicionar conector personalizado</b>.</li>
              <li>Dê o nome <b>1loop</b>, cole o link e salve. Numa conversa, ative o conector 1loop.</li>
            </>
          )}
          {tab === 'chatgpt' && (
            <>
              <li>Gere e copie o link acima.</li>
              <li>No ChatGPT, abra <b>Configurações › Apps e conectores</b> e, em Avançado, ligue o <b>modo desenvolvedor</b> (disponível em alguns planos).</li>
              <li>Crie um conector, cole o link, autenticação <b>nenhuma</b>, e salve.</li>
            </>
          )}
          {tab === 'dev' && (
            <>
              <li>Gere o link acima e adicione no arquivo de MCP (Cursor: <code>.cursor/mcp.json</code>; Claude Code: <code>claude mcp add --transport http 1loop LINK</code>):</li>
              <li style={{ listStyle: 'none', marginLeft: -20 }}>
                <pre style={{ margin: 0, padding: 12, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--line-2)', fontSize: 12.5, overflowX: 'auto' }}>{devJson}</pre>
              </li>
            </>
          )}
        </ol>
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Para começar, peça à sua IA:</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 320px', fontSize: 14, padding: '10px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px dashed var(--line-2)' }}>“{STARTER}”</span>
            <button type="button" className="btnGhost btnSm" onClick={() => copy(STARTER, 'p')}>{copied === 'p' ? 'Copiado ✓' : 'Copiar pedido'}</button>
          </div>
        </div>
      </section>

      {/* Contexto */}
      <section className="panel" aria-labelledby="ctx-h" style={{ display: 'grid', gap: 14 }}>
        <div>
          <h2 id="ctx-h" style={{ margin: 0, fontSize: 19 }}>Seu contexto {items.length ? <span className="muted" style={{ fontWeight: 600, fontSize: 15 }}>· {items.length}</span> : null}</h2>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 14.5 }}>
            Só a 1loop usa isso, para escrever posts e montar imagens (como gráficos) com dados que são seus de verdade. Nada de senha ou dado sensível de cliente.
          </p>
        </div>
        <form onSubmit={add} style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Tipo">
            {CONTEXT_TYPES.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={tipo === t.id} className="styleChip" onClick={() => setTipo(t.id)}>
                {t.nome}
              </button>
            ))}
          </div>
          <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional), ex.: Resultado do time em outubro" maxLength={120} aria-label="Título" />
          <textarea className="input" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={hint} rows={4} maxLength={4000} aria-label="Texto" style={{ resize: 'vertical', minHeight: 110 }} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn3d btnSm" disabled={pending || texto.trim().length < 3}>Salvar contexto</button>
            {msg && <span style={{ fontSize: 13.5, fontWeight: 600, color: msg.kind === 'ok' ? 'var(--teal)' : 'var(--red, #D93F3F)' }}>{msg.text}</span>}
          </div>
        </form>

        {items.length === 0 ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Ainda vazio. Comece por 1 número e 1 case: são o que mais muda a qualidade dos posts.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {items.map((i) => (
              <li key={i.id} className="card" style={{ padding: 14, display: 'grid', gap: 4, boxShadow: 'none' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
                  <b style={{ textTransform: 'uppercase', letterSpacing: 1 }}>{contextLabel(i.tipo)}</b>
                  <span className="muted">{fmt(i.created_at)}{i.fonte === 'mcp' ? ' · via IA conectada' : ''}</span>
                  <button type="button" className="linkBtn" style={{ marginLeft: 'auto', fontSize: 13, minHeight: 0 }} onClick={() => remove(i.id)} disabled={pending} aria-label="Apagar">
                    Apagar
                  </button>
                </div>
                {i.titulo && <b style={{ fontSize: 15 }}>{i.titulo}</b>}
                <span style={{ fontSize: 14.5, whiteSpace: 'pre-wrap' }}>{i.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
