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

test('draws plainly for an automated browser, and fully when asked', async ({ page }) => {
  await expect(page.getByTestId('rope-canvas')).toHaveAttribute('data-detail', 'plain');

  await page.goto('/?rope=full');
  const canvas = page.getByTestId('rope-canvas');
  await expect(canvas).toHaveAttribute('data-detail', 'full');
  await expect.poll(async () => Number(await canvas.getAttribute('data-triangles'))).toBeGreaterThan(20000);
});

test('changes the rope it is drawn with', async ({ page }) => {
  await expect(page.getByLabel('Rope')).toHaveValue('jute');
  for (const rope of ['kernmantle', 'polyester', 'sisal', 'cotton', 'line']) {
    await page.getByLabel('Rope').selectOption(rope);
    await expect
      .poll(async () => Number(await page.getByTestId('rope-canvas').getAttribute('data-triangles')))
      .toBeGreaterThan(1000);
  }
  await expect(page.getByTestId('verdict')).toHaveText('The two agree.');
});

test('lists the ropes in alphabetical order of the language in use', async ({ page }) => {
  const names = () =>
    page
      .getByLabel(/^(Rope|Cuerda)$/)
      .locator('option')
      .allTextContents();
  expect(await names()).toEqual([
    'Braided cotton',
    'Jute',
    'Kernmantle',
    'Plain line',
    'Sisal',
    'Three-strand polyester',
  ]);
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Laboratorio de nudos tóricos');
  expect(await names()).toEqual([
    'Algodón trenzado',
    'Alma y funda',
    'Línea lisa',
    'Poliéster de tres cordones',
    'Sisal',
    'Yute',
  ]);
});

test('recomputes when the knot changes', async ({ page }) => {
  await page.getByLabel('Passes through the hole (q)').fill('5');
  await expect(page.getByTestId('q-value')).toHaveText('5');
  await expect(page.getByTestId('crossings')).toHaveText('5');
  await expect(page.getByTestId('jones-geometry')).toHaveAttribute('aria-label', 't^2 + t^4 − t^5 + t^6 − t^7');
  await expect(page.getByTestId('verdict')).toHaveText('The two agree.');
});

test('draws a link of several loops when p and q share a factor, without moving the controls', async ({ page }) => {
  const slider = page.getByLabel('Passes through the hole (q)');
  // measured in the page, not in the window, so that scrolling does not count as movement
  const place = () => slider.evaluate((element) => Math.round(element.getBoundingClientRect().top + window.scrollY));
  const before = await place();
  await expect(page.getByTestId('loops')).toHaveText('1');

  // p = 2 and q = 4: two linked loops
  await slider.fill('4');
  await expect(page.getByTestId('loops')).toHaveText('2');
  await expect(page.getByTestId('link-note')).toContainText('2 separate loops');
  await expect(page.getByTestId('crossings')).toHaveText('4');
  await expect(page.getByTestId('verdict')).toHaveText('The two agree.');

  // the drawing is still there and the slider has not moved under the pointer
  await expect(page.getByTestId('rope-canvas').locator('canvas')).toBeVisible();
  expect(await place()).toBe(before);
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
