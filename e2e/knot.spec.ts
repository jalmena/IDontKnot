import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('opens on the figure-eight knot of the library, with what the core computes for it', async ({ page }) => {
  await expect(page).toHaveTitle('IDontKnot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  await expect(page.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');

  await expect(page.getByTestId('crossings')).toHaveText('4');
  await expect(page.getByTestId('jones-closure')).toHaveAttribute('aria-label', 't^(-2) − t^(-1) + 1 − t + t^2');
  // the shape in space is the stored diagram and keeps the rules of geometry: nothing needs saying
  await expect(page.getByTestId('facts')).toHaveAttribute('data-checked', 'ok');
  await expect(page.getByTestId('verdict')).toHaveCount(0);
});

test('draws the open rope with its parts named, and its diagram in its place when asked', async ({ page }) => {
  await expect
    .poll(async () => Number(await page.getByTestId('rope-canvas').getAttribute('data-triangles')))
    .toBeGreaterThan(1000);
  await expect(page.locator('.rope-view__names .tag')).toHaveText([
    'Standing part',
    'First loop',
    'Second loop',
    'Tail',
  ]);

  const diagram = page.getByTestId('diagram');
  await expect(diagram).toHaveCount(0);
  await page.getByRole('button', { name: 'Diagram' }).click();
  // a rope that passes under four times is drawn in five pieces
  await expect(diagram.locator('polyline')).toHaveCount(5);
  await expect(diagram.locator('text')).toHaveText([
    '1',
    '2',
    '3',
    '4',
    'Standing part',
    'First loop',
    'Second loop',
    'Tail',
  ]);

  await page.getByRole('button', { name: '3D' }).click();
  await expect(diagram).toHaveCount(0);
});

test('brings out the part of the rope that is chosen, on the rope and on its diagram', async ({ page }) => {
  const loop = page.getByTestId('parts').getByRole('button', { name: 'First loop' });
  const onRope = page.locator('.rope-view__names .tag--marked');
  await expect(onRope).toHaveCount(0);

  await loop.click();
  await expect(loop).toHaveAttribute('aria-pressed', 'true');
  await expect(onRope).toHaveText('First loop');

  // moving away keeps the choice, and so does changing to the diagram
  await page.mouse.move(2, 2);
  await expect(onRope).toHaveText('First loop');
  await page.getByRole('button', { name: 'Diagram' }).click();
  const diagram = page.getByTestId('diagram');
  await expect(diagram.locator('.diagram__marked')).toHaveCount(1);
  await expect(diagram.locator('.diagram__name--marked')).toHaveText('First loop');

  // choosing it again lets it go
  await loop.click();
  await page.mouse.move(2, 2);
  await expect(loop).toHaveAttribute('aria-pressed', 'false');
  await expect(diagram.locator('.diagram__marked')).toHaveCount(0);
});

test('shows everything about the knot on one screen of a laptop', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 900, 'on a narrow screen the panel goes under the view');
  await expect(page.getByTestId('facts')).toBeVisible();
  const edges = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top + window.scrollY), bottom: Math.round(box.bottom + window.scrollY) };
    });
  const [view, panel] = [await edges('.rope-view'), await edges('.panel')];
  expect(panel.bottom).toBeLessThanOrEqual(viewport?.height ?? 0);
  // side by side, the view and the panel are one height
  expect(panel).toEqual(view);
});

test('names the knot and its parts in Spanish', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nudo de ocho');
  await expect(page.getByTestId('parts').getByRole('button')).toHaveText([
    'Firme',
    'Primer bucle',
    'Segundo bucle',
    'Chicote',
  ]);
});

test('goes to the laboratory and back without loading the application again', async ({ page }) => {
  await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
  await page.getByRole('link', { name: 'Experiment' }).click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Torus knot laboratory');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
});

test('opens a knot by its address, and says so when there is no such knot or page', async ({ page }) => {
  await page.goto('/knots/figure-eight');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  await page.goto('/knots/no-such-knot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is no such knot in the library.');
  await page.goto('/some/deep/link');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is nothing at this address.');
  await page.getByRole('link', { name: 'Go to the library' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
});

test('has no accessibility violations that axe can detect', async ({ page }) => {
  await expect(page.getByTestId('facts')).toBeVisible();
  await page.getByTestId('parts').getByRole('button', { name: 'Tail' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
