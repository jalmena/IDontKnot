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
  await expect(page.getByTestId('verdict')).toContainText('The shape in space is the stored diagram');
});

test('draws the open rope, and its diagram with crossings numbered and parts named', async ({ page }) => {
  await expect
    .poll(async () => Number(await page.getByTestId('rope-canvas').getAttribute('data-triangles')))
    .toBeGreaterThan(1000);

  const diagram = page.getByTestId('diagram');
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
  await expect(page.locator('.rope-view__names .tag')).toHaveText([
    'Standing part',
    'First loop',
    'Second loop',
    'Tail',
  ]);
});

test('brings out the part of the rope that is chosen, in both views', async ({ page }) => {
  const loop = page.getByTestId('parts').getByRole('button', { name: 'First loop' });
  const marked = page.getByTestId('diagram').locator('.diagram__marked');
  await expect(marked).toHaveCount(0);

  await loop.click();
  await expect(loop).toHaveAttribute('aria-pressed', 'true');
  await expect(marked).toHaveCount(1);
  await expect(page.getByTestId('diagram').locator('.diagram__name--marked')).toHaveText('First loop');
  await expect(page.locator('.rope-view__names .tag--marked')).toHaveText('First loop');

  // moving away keeps the choice; choosing it again lets it go
  await page.getByRole('heading', { level: 1 }).hover();
  await expect(marked).toHaveCount(1);
  await loop.click();
  await page.getByRole('heading', { level: 1 }).hover();
  await expect(loop).toHaveAttribute('aria-pressed', 'false');
  await expect(marked).toHaveCount(0);
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
  await expect(page.getByTestId('verdict')).toBeVisible();
  await page.getByTestId('parts').getByRole('button', { name: 'Tail' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
