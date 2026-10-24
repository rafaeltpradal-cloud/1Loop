export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'cyan' | 'pink' | 'violet' | 'green' | 'amber' }) {
  return (
    <div className={`card ownKpi ${tone ?? ''}`}>
      <span className="ownKpiLabel">{label}</span>
      <b className="ownKpiValue">{value}</b>
      {hint && <span className="ownKpiHint">{hint}</span>}
    </div>
  );
}
