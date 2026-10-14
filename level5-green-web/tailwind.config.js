/** GREEN design tokens — every colour is a green shade.
 *  Prefixed `grn-` so they never clash with other levels' tokens when merged. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'grn-void': '#020A03', 'grn-ground': '#0C250E', 'grn-wall': '#1A4A1E', 'grn-player': '#85FF85', 'grn-light': '#39FF14',
        'grn-phantom': '#0A3816', 'grn-portal': '#C8FFC8', 'grn-moss': '#1E4620', 'grn-dim': '#58965A', 'grn-text': '#A0E8A0',
        'grn-pale': '#AAF0AA', 'grn-glow': '#6EFF6E',
      },
      fontFamily: { grn: ['"Special Elite"', '"Courier New"', 'monospace'], fell: ['"IM Fell English SC"', '"Palatino Linotype"', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
};
