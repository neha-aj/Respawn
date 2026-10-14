import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5179, strictPort: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'], testTimeout: 120_000 },
});
