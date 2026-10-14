/** ORANGE design tokens — every colour is an orange shade.
 *  Prefixed `org-` so they never clash with other levels' tokens when merged. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { 'org-stage': '#3A1300', 'org-spot': '#FF6600', 'org-dancer': '#FF9900', 'org-hud': '#FFE5CC', 'org-door': '#FFF0E0', 'org-ink': '#140600' },
      fontFamily: { org: ['"Press Start 2P"', '"Courier New"', 'monospace'] },
    },
  },
  plugins: [],
};
