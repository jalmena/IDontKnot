import react from '@vitejs/plugin-react';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

// "source" makes the core resolve to its TypeScript files, so there is nothing to build first.
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8080', '/healthz': 'http://127.0.0.1:8080' },
  },
  build: { outDir: 'dist', sourcemap: true, chunkSizeWarningLimit: 900 },
  test: { environment: 'node' },
});
