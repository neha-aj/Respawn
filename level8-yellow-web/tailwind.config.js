/** YELLOW design tokens — yellow/amber/gold/cream only. Prefixed `ylw-` so they never clash with other levels' tokens. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { 'ylw-ink': '#141000', 'ylw-deep': '#261E00', 'ylw-bg': '#4D3D00', 'ylw-gold': '#B39500', 'ylw-energy': '#FFEA00', 'ylw-fx': '#FFFFCC', 'ylw-door': '#FFFEE0' },
      fontFamily: { ylw: ['"Press Start 2P"', '"Courier New"', 'monospace'] },
    },
  },
  plugins: [],
};
