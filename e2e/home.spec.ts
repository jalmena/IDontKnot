import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const disciplines = (page: Page) => page.locator('.discipline');
const knots = (page: Page) => page.getByRole('navigation', { name: 'All knots' });

test('opens on the disciplines until one is chosen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('IDontKnot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Disciplines');
  await expect(disciplines(page).locator('.discipline__name')).toHaveText([
    'Climbing and mountaineering',
    'General and decorative',
    'Mathematics',
    'Nautical',
    'Pioneering',
    'Shibari',
  ]);
  // no discipline yet, so none to change at the top right
  await expect(page.getByTestId('discipline')).toHaveCount(0);
  // each is pictured by a knot in its rope
  const picture = disciplines(page).locator('img').first();
  await expect.poll(() => picture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(100);
});

test('leads from a discipline to its knots by category, in its rope, and keeps it', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-discipline="nautical"]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nautical');
  await expect(knots(page).getByRole('heading', { level: 2 })).toHaveText(['Stopper knots', 'Loops', 'Hitches']);
  await expect(knots(page).getByRole('link')).toHaveText(['Figure-eight knot', 'Bowline', 'Clove hitch']);
  // the discipline is at the top right of the page, to change it
  const chosen = page.getByTestId('discipline');
  await expect(chosen).toHaveValue('nautical');
  const header = await page.locator('.app__header').evaluate((element) => element.getBoundingClientRect().right);
  const right = await chosen.evaluate((element) => element.getBoundingClientRect().right);
  expect(header - right).toBeLessThan(2);
  // its knots are drawn in its rope
  await knots(page).getByRole('link', { name: 'Bowline' }).click();
  await expect(page.getByLabel('Material')).toHaveValue('polyester');

  // and it is remembered
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nautical');
});

test('changes the discipline at the top right: back to the knots, in the rope of the other', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'nautical'));
  await page.goto('/knots/bowline');
  await page.getByTestId('discipline').selectOption('theory');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mathematics');
  await expect(knots(page).getByRole('link')).toHaveText([
    'Double overhand knot',
    'Figure-eight knot',
    'Overhand knot',
  ]);
  await knots(page).getByRole('link', { name: 'Overhand knot', exact: true }).click();
  await expect(page.getByLabel('Material')).toHaveValue('line');
});

test('leads back to the choice of discipline from the name of the application', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'nautical'));
  await page.goto('/knots/bowline');
  await page.getByRole('link', { name: 'IDontKnot' }).click();
  await expect(page).toHaveURL(/\/disciplines$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Disciplines');
  // the discipline chosen is still there to change, and choosing one leads to its knots
  await expect(page.getByTestId('discipline')).toHaveValue('nautical');
  await page.locator('[data-discipline="pioneering"]').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pioneering');
});

test('opens the knot that is chosen above the list, without loading the application again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'decorative'));
  await page.goto('/');
  await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
  await knots(page).getByRole('link', { name: 'Figure-eight knot' }).click();
  await expect(page).toHaveURL(/\/knots\/figure-eight$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  await expect(page.getByTestId('rope-canvas')).toBeVisible();
  // the list stays, under the knot, and marks the knot that is open
  await expect(knots(page).getByRole('link', { name: 'Figure-eight knot' })).toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);

  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('General and decorative');
  await expect(page.getByTestId('rope-canvas')).toHaveCount(0);
});

test('goes from one knot to another by the row under it, in the same view', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'decorative'));
  await page.goto('/knots/figure-eight');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
  await page.evaluate(() => {
    (document.querySelector('[data-testid="rope-canvas"] canvas') as unknown as { marker: boolean }).marker = true;
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('tighten').click();
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '1');

  await knots(page).getByRole('link', { name: 'Overhand knot', exact: true }).click();
  await expect(page).toHaveURL(/\/knots\/overhand$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overhand knot');
  await expect(page.getByTestId('parts').getByRole('button')).toHaveText(['Standing part', 'Loop', 'Tail']);
  // the other knot is as it was tied, with its own steps, drawn on the same canvas
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '0');
  await expect(page.getByTestId('steps').getByRole('button')).toHaveCount(2);
  expect(
    await page.evaluate(
      () => (document.querySelector('[data-testid="rope-canvas"] canvas') as unknown as { marker?: boolean }).marker,
    ),
  ).toBe(true);
});

test('names the disciplines, the knots and their categories in Spanish', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Disciplinas');
  await expect(disciplines(page).locator('.discipline__name')).toHaveText([
    'Escalada y montaña',
    'General y decorativo',
    'Matemáticas',
    'Náutica',
    'Pionerismo',
    'Shibari',
  ]);
  await page.locator('[data-discipline="decorative"]').click();
  await expect(page.getByRole('navigation', { name: 'Todos los nudos' }).getByRole('heading')).toHaveText([
    'Nudos de tope',
    'Gazas',
    'Amarres',
  ]);
  await expect(page.getByRole('navigation', { name: 'Todos los nudos' }).getByRole('link')).toHaveText([
    'Nudo de ocho',
    'Nudo simple',
    'Nudo simple doble',
    'As de guía',
    'Gaza de ocho',
    'Nudo de alondra',
  ]);
  await expect(page.getByTestId('discipline')).toHaveValue('decorative');
});

test('has no accessibility violations that axe can detect, on the disciplines and on a list', async ({ page }) => {
  await page.goto('/');
  await expect(disciplines(page)).toHaveCount(6);
  const violations = async () =>
    (await new AxeBuilder({ page }).analyze()).violations.map((violation) => `${violation.id}: ${violation.help}`);
  expect(await violations()).toEqual([]);
  await page.locator('[data-discipline="decorative"]').click();
  await expect(knots(page).locator('img')).toHaveCount(6);
  expect(await violations()).toEqual([]);
});
