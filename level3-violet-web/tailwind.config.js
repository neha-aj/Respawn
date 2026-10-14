/** VIOLET design tokens — every colour is a shade of violet.
 *  Prefixed `vio-` so they never clash with other levels' tokens when the projects are merged. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'vio-bg': '#120024',
        'vio-deep': '#220440',
        'vio-dim': '#3A0A64',
        'vio-drone': '#4A0E4E',
        'vio-mid': '#6218AA',
        'vio-player': '#8F00FF',
        'vio-wall': '#A020F0',
        'vio-soft': '#BA8CFF',
        'vio-orchid': '#DA70D6',
        'vio-lilac': '#E0B0FF',
        'vio-proj': '#DCC6FF',
        'vio-door': '#F0DCFF',
        'vio-pale': '#ECDEFF',
      },
      fontFamily: { vio: ['Orbitron', 'Bahnschrift', 'sans-serif'] },
    },
  },
  plugins: [],
};
