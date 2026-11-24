import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const port = Number(process.env['PORT'] ?? 8080);
const hostname = process.env['HOST'] ?? '0.0.0.0';
const version = process.env['IDK_VERSION'] ?? 'dev';
const webDir = resolve(process.env['IDK_WEB_DIR'] ?? fileURLToPath(new URL('../../web/dist', import.meta.url)));
const hasInterface = existsSync(resolve(webDir, 'index.html'));

const app = createApp({ version, webDir: hasInterface ? relative(process.cwd(), webDir) || '.' : undefined });

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`IDontKnot ${version} listening on http://${info.address}:${info.port}`);
  if (!hasInterface) console.log(`No built interface at ${webDir}: serving the API only.`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
