/** Blue-only design tokens. Every colour here is a shade of blue. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        abyss: '#020817',
        navy: '#06152D',
        dark: '#0A2450',
        deep: '#103D78',
        primary: '#1769C2',
        electric: '#258BFF',
        cyan: '#52C7FF',
        pale: '#A5E2FF',
        ice: '#E4F5FF',
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        term: ['VT323', 'monospace'],
      },
      keyframes: {
        pulseborder: { '0%,100%': { borderColor: '#258BFF' }, '50%': { borderColor: '#0A2450' } },
      },
      animation: { pulseborder: 'pulseborder 0.5s steps(2) infinite' },
    },
  },
  plugins: [],
};
