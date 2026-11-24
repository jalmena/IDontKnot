import { defineConfig } from 'vitest/config';

// Resolve the core from its TypeScript source, as the server does when it runs.
export default defineConfig({
  resolve: { conditions: ['source'] },
  ssr: { resolve: { conditions: ['source'] } },
});
