import { closedBraid } from '@idontknot/core';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

const app = createApp({ version: 'test' });

const check = (body: unknown) =>
  app.request('/api/v1/diagrams/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('health', () => {
  it('answers with its version', async () => {
    const response = await app.request('/healthz');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', version: 'test' });
  });
});

describe('checking a diagram', () => {
  const trefoil = closedBraid([1, 1, 1], 2);

  it('accepts the trefoil', async () => {
    const response = await check(trefoil);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: true, issues: [], genus: 0, ropeEndsShareOneFace: true });
  });

  it('reports a code that cannot be drawn on a sphere', async () => {
    const mixed = { ...trefoil, crossings: trefoil.crossings.map((c, i) => ({ id: c.id, sign: i === 2 ? -1 : 1 })) };
    const result = (await (await check(mixed)).json()) as { valid: boolean; genus: number; issues: { rule: string }[] };
    expect(result.valid).toBe(false);
    expect(result.genus).toBe(1);
    expect(result.issues.map((issue) => issue.rule)).toEqual(['T3']);
  });

  it('reports a crossing that is not visited once over and once under', async () => {
    const broken = { ...trefoil, strands: { k0: trefoil.strands['k0']?.slice(1) } };
    const result = (await (await check(broken)).json()) as { valid: boolean; issues: { rule: string }[] };
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.rule === 'T1')).toBe(true);
  });

  it('refuses what is not a diagram', async () => {
    expect((await check({ crossings: 3 })).status).toBe(400);
    expect((await check('not json')).status).toBe(400);
  });
});

describe('unknown API paths', () => {
  it('answer 404 as JSON', async () => {
    const response = await app.request('/api/v1/nothing');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not found' });
  });
});
