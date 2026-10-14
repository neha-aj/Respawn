/** RED design tokens — monochromatic red family only. Prefixed `red-` so they never clash with other levels' tokens. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { 'red-bg': '#12060A', 'red-deep': '#3A0A14', 'red-plat': '#5A0F1C', 'red-edge': '#FF3B4E', 'red-hot': '#FF1744', 'red-text': '#FFE1E1', 'red-coat': '#8F1830' },
      fontFamily: { mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'] },
    },
  },
  plugins: [],
};
