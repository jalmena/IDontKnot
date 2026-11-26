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
  await expect(knots.getByRole('link')).toHaveText(['Bowline', 'Figure-eight knot', 'Overhand knot']);
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

test('goes from one knot to another by the row under it, in the same view', async ({ page }) => {
  await page.goto('/knots/figure-eight');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
  await page.evaluate(() => {
    (document.querySelector('[data-testid="rope-canvas"] canvas') as unknown as { marker: boolean }).marker = true;
  });
  // something of the first knot is chosen, and it is tightened
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('tighten').click();
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '1');

  await page.getByRole('navigation', { name: 'All knots' }).getByRole('link', { name: 'Overhand knot' }).click();
  await expect(page).toHaveURL(/\/knots\/overhand$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overhand knot');
  await expect(page.getByTestId('parts').getByRole('button')).toHaveText(['Standing part', 'Loop', 'Tail']);
  // the other knot is as it was tied, with its own steps, drawn on the same canvas
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '0');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
  await expect(page.getByTestId('steps').getByRole('button')).toHaveCount(2);
  await expect(page.getByTestId('tighten')).toHaveText('Tighten');
  expect(
    await page.evaluate(
      () => (document.querySelector('[data-testid="rope-canvas"] canvas') as unknown as { marker?: boolean }).marker,
    ),
  ).toBe(true);
  // its closure is the trefoil knot
  await page.getByRole('tab', { name: 'Mathematics' }).click();
  await expect(page.getByTestId('jones-closure')).toHaveAttribute('aria-label', '−t^(-4) + t^(-3) + t^(-1)');
});

test('names the library and its knots in Spanish', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nudos');
  await expect(page.getByRole('navigation', { name: 'Todos los nudos' }).getByRole('link')).toHaveText([
    'As de guía',
    'Nudo de ocho',
    'Nudo simple',
  ]);
  await expect(page.getByRole('navigation', { name: 'Secciones' }).getByRole('link')).toHaveText([
    'Nudos',
    'Laboratorio',
  ]);
});

test('has no accessibility violations that axe can detect', async ({ page }) => {
  await expect(page.getByRole('navigation', { name: 'All knots' }).locator('img')).toHaveCount(3);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
