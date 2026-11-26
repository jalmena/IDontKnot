import { serveStatic } from '@hono/node-server/serve-static';
import { checkStructure, embed, ropeEndsShareOneFace, type Diagram, type Issue } from '@idontknot/core';
import { Hono, type MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';

export interface AppOptions {
  readonly version: string;
  /** Directory of the built interface, relative to the working directory. Omit to serve the API only. */
  readonly webDir?: string | undefined;
}

const MAX_CROSSINGS = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A check of shape only, so that the core is never handed something that is not a diagram. */
function looksLikeDiagram(value: unknown): value is Diagram {
  if (!isRecord(value)) return false;
  const { components, crossings, strands } = value;
  if (!Array.isArray(components) || !Array.isArray(crossings) || !isRecord(strands)) return false;
  if (crossings.length > MAX_CROSSINGS) return false;
  const componentsOk = components.every(
    (c) =>
      isRecord(c) &&
      typeof c['id'] === 'string' &&
      (c['kind'] === 'rope' || c['kind'] === 'rigid') &&
      typeof c['closed'] === 'boolean',
  );
  const crossingsOk = crossings.every(
    (c) => isRecord(c) && typeof c['id'] === 'string' && typeof c['sign'] === 'number',
  );
  const strandsOk = Object.values(strands).every(
    (visits) =>
      Array.isArray(visits) &&
      visits.every((v) => Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && typeof v[1] === 'string'),
  );
  return componentsOk && crossingsOk && strandsOk;
}

/** Says for how long a browser may keep a file of the interface without asking for it again. */
const keeping: MiddlewareHandler = async (c, next) => {
  await next();
  if (!c.res.ok) return;
  // the page names the files it needs, so it is asked for each time
  if (c.res.headers.get('content-type')?.startsWith('text/html')) c.header('Cache-Control', 'no-cache');
  // the build names each file in assets/ after its contents: it never changes, and may be kept for good
  else if (c.req.path.startsWith('/assets/')) c.header('Cache-Control', 'public, max-age=31536000, immutable');
};

export function createApp(options: AppOptions): Hono {
  const app = new Hono();
  app.use(secureHeaders());

  app.get('/healthz', (c) => c.json({ status: 'ok', version: options.version }));

  /**
   * Checks a diagram with the same core the browser uses: structure (rules T1 and T2),
   * whether it can be drawn on a sphere (T3), and whether its rope ends lie in one face (T5).
   */
  app.post('/api/v1/diagrams/check', bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'the request body is not JSON' }, 400);
    }
    if (!looksLikeDiagram(body)) {
      return c.json({ error: 'expected an object with components, crossings and strands' }, 400);
    }
    const issues: Issue[] = checkStructure(body);
    if (issues.length > 0) return c.json({ valid: false, issues });
    const { genus } = embed(body);
    if (genus !== 0) {
      issues.push({
        rule: 'T3',
        message: `the code cannot be drawn on a sphere: it needs a surface of genus ${genus}`,
      });
    }
    return c.json({ valid: issues.length === 0, issues, genus, ropeEndsShareOneFace: ropeEndsShareOneFace(body) });
  });

  app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

  if (options.webDir !== undefined) {
    // what can be made smaller is sent compressed: the script of the interface goes from a megabyte to a third
    app.use('*', compress());
    app.use('*', keeping);
    app.use('*', serveStatic({ root: options.webDir }));
    // any other path belongs to the single-page interface
    app.get('*', serveStatic({ root: options.webDir, path: 'index.html' }));
  }
  return app;
}
