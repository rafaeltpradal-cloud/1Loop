// Aparece na hora em que a pessoa troca de página, enquanto os dados carregam.
export default function Loading() {
  return (
    <div className="pageSkeleton" role="status" aria-label="Carregando">
      <span className="sk sk-eyebrow" />
      <span className="sk sk-title" />
      <span className="sk sk-line" />
      <div className="sk-grid">
        <span className="sk sk-card" />
        <span className="sk sk-card" />
        <span className="sk sk-card" />
      </div>
    </div>
  );
}
