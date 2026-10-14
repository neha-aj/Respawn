/** INDIGO design tokens — every colour is an indigo/violet shade.
 *  Prefixed `ind-` so they never clash with other levels' tokens when merged. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ind-bg': '#08001A', 'ind-grid': '#14052B', 'ind-ship': '#4B0082', 'ind-well': '#1A0033', 'ind-laser': '#6C2DC7',
        'ind-struct': '#1E003B', 'ind-portal': '#A066FF', 'ind-deep': '#2C0A5C', 'ind-mid': '#5828AA', 'ind-soft': '#8C6EE6',
        'ind-pale': '#C8B6FF', 'ind-lilac': '#B08CFF', 'ind-white': '#E8E0FF',
      },
      fontFamily: { ind: ['"Exo 2"', '"Agency FB"', 'Bahnschrift', 'sans-serif'] },
    },
  },
  plugins: [],
};
