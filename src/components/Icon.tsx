// Hand-drawn 24px stroke icons. Always shown next to a word, never alone.
const PATHS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20',
  plus: 'M12 5v14M5 12h14',
  plan: 'M4 19h16M6 16V11M10 16V7M14 16v-6M18 16V5',
  shield: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Zm-3 9 2.2 2.2L15.5 10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5',
  transport: 'M5 16V8.5C5 6.6 6.6 5 8.5 5h7C17.4 5 19 6.6 19 8.5V16M5 16h14M5 16v2.5M19 16v2.5M5 11h14M8 13.5h.01M16 13.5h.01M8.5 5V3.5h7V5',
  food: 'M4 11h16c0 4.4-3.6 8-8 8s-8-3.6-8-8Zm4-3.5c0-1 .8-1.5.8-2.5M12 7.5c0-1 .8-1.5.8-2.5M16 7.5c0-1 .8-1.5.8-2.5',
  electricity: 'M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z',
  data_airtime: 'M8 3.5h8a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V5A1.5 1.5 0 0 1 8 3.5ZM11 17.5h2M9.5 9.5a3.5 3.5 0 0 1 5 0M11 11.3a1.4 1.4 0 0 1 2 0',
  grant: 'M3.5 9.5 12 4.5l8.5 5M5 9.5V18M9.5 9.5V18M14.5 9.5V18M19 9.5V18M3.5 20h17',
  piece_job: 'M4 8.5h16v10H4v-10Zm5 0V6.5c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v2M4 13h16',
  trade: 'M4 9.5 5.5 4.5h13L20 9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5s2.6-1.1 2.6-2.5c0 1.4 1.1 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1 2.5 2.6 2.5S20 10.9 20 9.5M5.5 12v7.5h13V12M10 19.5v-4h4v4',
  salary: 'M3.5 7h17v10h-17V7Zm8.5 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6.5 10v.01M17.5 14v.01',
  gift: 'M4 10h16v3H4v-3Zm1.5 3v7h13v-7M12 10v10M12 10c-1.5-3-5-3.5-5-1.5S10 10 12 10Zm0 0c1.5-3 5-3.5 5-1.5S14 10 12 10Z',
  income: 'M12 19V5m0 0-5 5m5-5 5 5',
  rent: 'M4 20V10l8-6 8 6v10H4Zm6 0v-6h4v6',
  school: 'M3 9 12 5l9 4-9 4-9-4Zm3.5 1.8V15c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.2M21 9v5',
  stokvel: 'M8 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19c.5-3 2.3-4.8 4.5-4.8s4 1.8 4.5 4.8M11.5 19c.5-3 2.3-4.8 4.5-4.8s4 1.8 4.5 4.8',
  savings_goal: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM12 3v2',
  funeral: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  debt: 'M5 6h14v12H5V6Zm3 4h8M8 14h5',
  health: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z',
  household: 'M5 10h14l-1 10H6L5 10Zm4 0V7a3 3 0 0 1 6 0v3',
  other: 'M6 12h.01M12 12h.01M18 12h.01',
  opening_balance: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-5V8h3a2.5 2.5 0 0 1 0 5h-3m3 0 2.5 3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  warning: 'M12 4 2.8 19.5h18.4L12 4Zm0 6v4.5m0 2.5h.01',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  sparkle: 'M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4-5.7-1.8L10.2 9 12 3.5ZM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z',
  offline: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 4.3-2.4M19 13a10 10 0 0 0-2.3-1.6M2 9.5a15 15 0 0 1 4.6-2.8M22 9.5A15 15 0 0 0 11 5.6M12 20h.01',
  sync: 'M20 11a8 8 0 0 0-14.3-4.8L4 8m0-4v4h4m-4 5a8 8 0 0 0 14.3 4.8L20 16m0 4v-4h-4',
  trash: 'M5 7h14M10 7V5h4v2m-7 0 1 13h8l1-13M10.5 11v5.5M13.5 11v5.5',
  language: 'M4 5h9M8.5 3v2c0 4-2 7.5-4.5 9m2.5-5c1 2.5 3 4.5 6 5.5M13 21l4-9 4 9m-6.5-3h5',
  logout: 'M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 16l-4-4 4-4M6 12h10',
  calc: 'M6 3.5h12A1.5 1.5 0 0 1 19.5 5v14a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Zm2 3h8v3H8v-3ZM8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h4',
  calendar: 'M4.5 6h15v14h-15V6Zm0 4h15M8.5 3.5V7M15.5 3.5V7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
};

export function Icon({ name, size = 22, className = '', strokeWidth = 1.8 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const d = PATHS[name] ?? PATHS.other;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}
