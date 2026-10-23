import { Fragment } from 'react';

// Mostra os textos de lib/legal.ts: títulos (###), listas (-), tabelas (|) e **negrito**.
function inline(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <Fragment key={i}>{p}</Fragment>));
}

export function LegalText({ title, updated, text }: { title: string; updated: string; text: string }) {
  const blocks = text.split(/\n\n+/);
  return (
    <article className="card legal">
      <h1>{title}</h1>
      <p className="muted" style={{ fontSize: 13 }}>Última atualização: {updated}</p>
      {blocks.map((b, i) => {
        if (b.startsWith('### ')) return <h2 key={i}>{b.slice(4)}</h2>;
        const lines = b.split('\n');
        if (lines.every((l) => l.startsWith('- '))) return <ul key={i}>{lines.map((l, k) => <li key={k}>{inline(l.slice(2))}</li>)}</ul>;
        if (lines.every((l) => l.startsWith('| '))) {
          const rows = lines.map((l) => l.slice(2).split(' | '));
          return (
            <div key={i} className="legalTable">
              <table>
                <thead><tr>{rows[0].map((c, k) => <th key={k}>{c}</th>)}</tr></thead>
                <tbody>{rows.slice(1).map((r, k) => <tr key={k}>{r.map((c, n) => <td key={n}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        return <p key={i}>{inline(b)}</p>;
      })}
    </article>
  );
}
