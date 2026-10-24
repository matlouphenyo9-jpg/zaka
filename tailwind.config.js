/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FAF8F2',
        card: '#FFFFFF',
        ink: { DEFAULT: '#102A43', soft: '#486581', faint: '#829AB1' },
        line: '#E6E1D3',
        teal: { DEFAULT: '#006B64', dark: '#00524C', soft: '#E3F1EF' },
        amber: { DEFAULT: '#B7791F', soft: '#FDF3DC', ink: '#5C3D07' },
        risk: { DEFAULT: '#B42318', soft: '#FDECEA' },
        gold: '#C9A227',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Ubuntu', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontSize: { base: ['1rem', '1.5rem'] },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { card: '0 1px 2px rgba(16,42,67,.06), 0 4px 16px rgba(16,42,67,.05)' },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
    },
  },
  plugins: [],
};
