// Zaka wordmark with a rand-coin mark, drawn by hand as strokes (no font dependency).
export function CoinMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18.5" fill="#C9A227" />
      <circle cx="20" cy="20" r="14.5" fill="none" stroke="#8C6D12" strokeWidth="1.4" strokeDasharray="1.6 2.2" />
      <path d="M15 29V11.5h6.2a4.9 4.9 0 0 1 0 9.8H15m6 0 5 7.7" fill="none" stroke="#102A43" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ height = 32, tone = 'ink' }: { height?: number; tone?: 'ink' | 'light' }) {
  const ink = tone === 'ink' ? '#102A43' : '#FAF8F2';
  return (
    <svg height={height} width={height * 4} viewBox="0 0 176 44" role="img" aria-label="Zaka" className="block">
      <title>Zaka</title>
      <g transform="translate(0 4)">
        <circle cx="18" cy="20" r="17.5" fill="#C9A227" />
        <circle cx="18" cy="20" r="13.6" fill="none" stroke="#8C6D12" strokeWidth="1.3" strokeDasharray="1.5 2.1" />
        <path d="M13.2 28.5V11.8h5.9a4.7 4.7 0 0 1 0 9.4h-5.9m5.7 0 4.8 7.3" fill="none" stroke="#102A43" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g fill="none" stroke={ink} strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M48 16h18L48 39h18" />
        <circle cx="86.5" cy="27.5" r="11.5" />
        <path d="M98 16v23" />
        <path d="M110 5v34M127 16l-14 12.5M118.5 24l10 15" />
        <circle cx="149.5" cy="27.5" r="11.5" />
        <path d="M161 16v23" />
      </g>
    </svg>
  );
}
