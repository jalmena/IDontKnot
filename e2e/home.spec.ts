import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('opens on the knots of the library, each with its name and its picture', async ({ page }) => {
  await expect(page).toHaveTitle('IDontKnot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Knots');
  await expect(page.getByRole('link', { name: 'Knots', exact: true })).toHaveAttribute('aria-current', 'page');

  const knots = page.getByRole('navigation', { name: 'All knots' });
  await expect(knots.getByRole('link')).toHaveText(['Figure-eight knot']);
  // the picture is drawn a moment after the page: it is an image with something in it
  const picture = knots.locator('img').first();
  await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(100);
  // no knot is open: there is no view of rope on the page
  await expect(page.getByTestId('rope-canvas')).toHaveCount(0);
});

test('opens the knot that is chosen above the list, without loading the application again', async ({ page }) => {
  await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
  await page.getByRole('link', { name: 'Figure-eight knot' }).click();
  await expect(page).toHaveURL(/\/knots\/figure-eight$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  await expect(page.getByTestId('rope-canvas')).toBeVisible();
  // the list stays, under the knot, and marks the knot that is open
  const open = page.getByRole('navigation', { name: 'All knots' }).getByRole('link', { name: 'Figure-eight knot' });
  await expect(open).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Knots');
  await expect(page.getByTestId('rope-canvas')).toHaveCount(0);
});

test('names the library and its knots in Spanish', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nudos');
  await expect(page.getByRole('navigation', { name: 'Todos los nudos' }).getByRole('link')).toHaveText([
    'Nudo de ocho',
  ]);
  await expect(page.getByRole('navigation', { name: 'Secciones' }).getByRole('link')).toHaveText([
    'Nudos',
    'Laboratorio',
  ]);
});

test('has no accessibility violations that axe can detect', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'All knots' }).locator('img')).toHaveCount(1);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
