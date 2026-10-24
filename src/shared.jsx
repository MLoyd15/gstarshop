function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`icon ${className}`}>{children}</span>;
}

function Butterfly({ className = '' }) {
  return (
    <svg className={`butterfly ${className}`} viewBox="0 0 80 64" aria-hidden="true">
      <defs>
        <linearGradient id="butterflyLeft" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-hover)" />
        </linearGradient>
        <linearGradient id="butterflyRight" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--text-secondary)" />
          <stop offset="100%" stopColor="var(--muted)" />
        </linearGradient>
      </defs>
      <g className="butterfly-left-wing">
        <path d="M38 29C31 11 13 5 7 13c-7 10 3 22 30 24-16 1-24 8-20 16 5 9 17 6 24-8Z" fill="url(#butterflyLeft)" />
        <path d="M35 32C24 25 16 19 11 14M35 37c-8 2-13 6-16 12" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" />
        <circle cx="15" cy="19" r="2" fill="#fff" fillOpacity=".7" />
        <circle cx="23" cy="46" r="1.7" fill="#fff" fillOpacity=".7" />
      </g>
      <g className="butterfly-right-wing">
        <path d="M42 29c7-18 25-24 31-16 7 10-3 22-30 24 16 1 24 8 20 16-5 9-17 6-24-8Z" fill="url(#butterflyRight)" />
        <path d="M45 32c11-7 19-13 24-18M45 37c8 2 13 6 16 12" fill="none" stroke="#fff" strokeOpacity=".58" strokeWidth="1.2" />
        <circle cx="65" cy="19" r="2" fill="#fff" fillOpacity=".8" />
        <circle cx="57" cy="46" r="1.7" fill="#fff" fillOpacity=".8" />
      </g>
      <path d="M39.5 28c-1.7 8-1.5 17 .5 24 2-7 2.2-16 .5-24Z" fill="var(--accent)" />
      <path d="M39 29c-3-6-5-8-8-9M41 29c3-6 5-8 8-9" fill="none" stroke="var(--accent)" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  );
}

export { Icon, Butterfly };
