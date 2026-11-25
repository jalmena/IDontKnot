import { expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

// a small stand-in for the built interface: a page, a file named after its contents, and one that is not
const app = createApp({ version: 'test', webDir: 'test/web' });

const keeping = async (path: string) => {
  const response = await app.request(path);
  expect(response.status).toBe(200);
  return response.headers.get('cache-control');
};

it('lets a browser keep for good a file that the build named after its contents', async () => {
  expect(await keeping('/assets/index-1a2b3c4d.js')).toBe('public, max-age=31536000, immutable');
});

it('has the page asked for each time, at whatever address it is served', async () => {
  expect(await keeping('/')).toBe('no-cache');
  expect(await keeping('/knots/figure-eight')).toBe('no-cache');
  // a file of the build that is no longer there is answered with the page: that must not be kept
  expect(await keeping('/assets/index-00000000.js')).toBe('no-cache');
});

it('says nothing about the other files, which keep their names when they change', async () => {
  expect(await keeping('/font.txt')).toBeNull();
});
