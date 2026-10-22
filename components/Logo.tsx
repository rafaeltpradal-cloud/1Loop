// Símbolo da 1loop: anéis ondulando, com as cores girando em degradê.
// O <path id="lobe"> é definido uma vez no layout raiz (LoopDefs).

const RINGS: Array<[string, string, string]> = [
  ['16 -3', '-4.48s', 'rotate(-35.523) scale(30)'],
  ['13.45 -2.625', '-3.92s', 'rotate(-31.083) scale(39.153)'],
  ['11.008 -2.25', '-3.36s', 'rotate(-26.643) scale(47.318)'],
  ['8.685 -1.875', '-2.80s', 'rotate(-22.202) scale(55.148)'],
  ['6.498 -1.5', '-2.24s', 'rotate(-17.762) scale(62.768)'],
  ['4.471 -1.125', '-1.68s', 'rotate(-13.321) scale(70.235)'],
  ['2.639 -0.75', '-1.12s', 'rotate(-8.881) scale(77.583)'],
  ['1.072 -0.375', '-0.56s', 'rotate(-4.44) scale(84.833)'],
  ['0 0', '0s', 'rotate(0) scale(92)'],
];

export function LoopMark({ size = 38, stroke = 1.3 }: { size?: number; stroke?: number }) {
  return (
    <svg viewBox="-106 -106 212 212" aria-hidden="true" style={{ width: size, height: size, overflow: 'visible', flex: 'none' }}>
      {RINGS.map(([t, delay, tr], i) => (
        <g key={i} transform={`translate(${t})`}>
          <g className="lw" style={{ animationDelay: delay }}>
            <use className="tint" href="#lobe" transform={tr} strokeWidth={stroke + i * 0.05} style={{ animationDelay: `${-i}s` }} />
          </g>
        </g>
      ))}
    </svg>
  );
}

export function Wordmark({ size = 21 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, fontWeight: 700, letterSpacing: '-0.3px', fontSize: size }}>
      <span className="graphite">1loop</span>
      <span className="grad">creators</span>
    </span>
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <a href={href} aria-label="1loop creators — início" style={{ display: 'inline-flex', alignItems: 'center', gap: 12, textDecoration: 'none', minHeight: 44 }}>
      <LoopMark />
      <Wordmark />
    </a>
  );
}

export function LoopDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <path
          id="lobe"
          vectorEffect="non-scaling-stroke"
          fill="none"
          strokeLinejoin="round"
          d="M1.09 0C1.09 0.058 1.024 0.122 0.985 0.174C0.946 0.226 0.875 0.257 0.855 0.311C0.835 0.366 0.869 0.435 0.866 0.5C0.863 0.565 0.872 0.656 0.835 0.701C0.798 0.745 0.706 0.751 0.643 0.766C0.579 0.781 0.505 0.759 0.455 0.788C0.405 0.817 0.386 0.892 0.342 0.94C0.298 0.987 0.246 1.063 0.189 1.073C0.132 1.083 0.058 1.03 0 1C-0.058 0.97 -0.101 0.906 -0.158 0.896C-0.215 0.886 -0.278 0.932 -0.342 0.94C-0.407 0.948 -0.495 0.973 -0.545 0.944C-0.595 0.915 -0.617 0.826 -0.643 0.766C-0.668 0.706 -0.66 0.629 -0.697 0.585C-0.734 0.541 -0.811 0.535 -0.866 0.5C-0.921 0.465 -1.004 0.427 -1.024 0.373C-1.044 0.318 -1.004 0.236 -0.985 0.174C-0.966 0.112 -0.91 0.058 -0.91 0C-0.91 -0.058 -0.966 -0.112 -0.985 -0.174C-1.004 -0.236 -1.044 -0.318 -1.024 -0.373C-1.004 -0.427 -0.921 -0.465 -0.866 -0.5C-0.811 -0.535 -0.734 -0.541 -0.697 -0.585C-0.66 -0.629 -0.668 -0.706 -0.643 -0.766C-0.617 -0.826 -0.595 -0.915 -0.545 -0.944C-0.495 -0.973 -0.407 -0.948 -0.342 -0.94C-0.278 -0.932 -0.215 -0.886 -0.158 -0.896C-0.101 -0.906 -0.058 -0.97 0 -1C0.058 -1.03 0.132 -1.083 0.189 -1.073C0.246 -1.063 0.298 -0.987 0.342 -0.94C0.386 -0.892 0.405 -0.817 0.455 -0.788C0.505 -0.759 0.579 -0.781 0.643 -0.766C0.706 -0.751 0.798 -0.745 0.835 -0.701C0.872 -0.656 0.863 -0.565 0.866 -0.5C0.869 -0.435 0.835 -0.366 0.855 -0.311C0.875 -0.257 0.946 -0.226 0.985 -0.174C1.024 -0.122 1.09 -0.058 1.09 0Z"
        />
      </defs>
    </svg>
  );
}
