import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Two pages: the full game (index.html) and BnW (bnw.html), which is built straight
// from ../BnWGame.jsx so that file stays the single source of truth.
// The other levels are prebuilt into public/levels/ by `npm run levels`.
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { dedupe: ['react', 'react-dom'] },   // BnWGame.jsx lives outside this folder
  server: { port: 5180, strictPort: false, fs: { allow: ['..'] } },
  build: {
    rollupOptions: { input: { main: 'index.html', bnw: 'bnw.html' } },
  },
});
