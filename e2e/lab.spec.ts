import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('opens on the torus knot laboratory, in English, showing the trefoil', async ({ page }) => {
  await expect(page).toHaveTitle('IDontKnot');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Torus knot laboratory');

  await expect(page.getByTestId('crossings')).toHaveText('3');
  await expect(page.getByTestId('jones-geometry')).toHaveAttribute('aria-label', 't + t^3 − t^4');
  await expect(page.getByTestId('jones-braid')).toHaveAttribute('aria-label', 't + t^3 − t^4');
  await expect(page.getByTestId('verdict')).toHaveText('The two agree.');
});

test('draws the rope', async ({ page }) => {
  const canvas = page.getByTestId('rope-canvas').locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(200);
  expect(box?.height).toBeGreaterThan(150);

  // the viewport reports how many triangles its last frame drew: an empty canvas would report none
  await expect
    .poll(async () => Number(await page.getByTestId('rope-canvas').getAttribute('data-triangles')))
    .toBeGreaterThan(1000);
});

test('recomputes when the knot changes', async ({ page }) => {
  await page.getByLabel('Passes through the hole (q)').fill('5');
  await expect(page.getByTestId('q-value')).toHaveText('5');
  await expect(page.getByTestId('crossings')).toHaveText('5');
  await expect(page.getByTestId('jones-geometry')).toHaveAttribute('aria-label', 't^2 + t^4 − t^5 + t^6 − t^7');
  await expect(page.getByTestId('verdict')).toHaveText('The two agree.');

  // p = 2 and q = 4 share a factor: not one knot
  await page.getByLabel('Passes through the hole (q)').fill('4');
  await expect(page.getByRole('status').filter({ hasText: 'share a factor' })).toBeVisible();
  await expect(page.getByTestId('verdict')).toHaveCount(0);
});

test('switches to Spanish and remembers the choice', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laboratorio de nudos tóricos');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByTestId('verdict')).toHaveText('Los dos coinciden.');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laboratorio de nudos tóricos');
});

test('has no accessibility violations that axe can detect', async ({ page }) => {
  await expect(page.getByTestId('verdict')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test('serves the interface for any path, and the health check', async ({ page, request }) => {
  await page.goto('/some/deep/link');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const health = await request.get('/healthz');
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ status: 'ok' });
});
