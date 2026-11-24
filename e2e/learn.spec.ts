import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const STOPS = [37.795, 47.786, 64.039];
const progress = (page: import('@playwright/test').Page) => page.getByTestId('progress');
const reached = async (page: import('@playwright/test').Page) => Number(await progress(page).inputValue());
const triangles = async (page: import('@playwright/test').Page) =>
  Number(await page.getByTestId('rope-canvas').getAttribute('data-triangles'));

test.beforeEach(async ({ page }) => {
  await page.goto('/learn');
  await expect(page.getByTestId('steps')).toHaveAttribute('data-checked', 'ok');
});

test('opens on how the figure-eight knot is tied, with its steps and nothing done yet', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  await expect(page.getByRole('link', { name: 'Learn' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('steps').getByRole('button')).toHaveText([
    'Lead the end round and over the standing part, to make a loop.',
    'Take it round behind the standing part.',
    'Pass it down through the loop: over its near side, and out under its far side.',
  ]);
  await expect(page.getByTestId('steps').locator('[aria-current]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(await reached(page)).toBe(12);
  await expect(page.getByTestId('verdict')).toHaveCount(0);
});

test('plays one step at a time, and goes back', async ({ page }) => {
  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => reached(page), { timeout: 15_000 }).toBeCloseTo(STOPS[0]!, 1);
  await expect(page.getByTestId('steps').locator('[aria-current="step"]')).toContainText('to make a loop');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => reached(page), { timeout: 15_000 }).toBeCloseTo(STOPS[1]!, 1);
  await expect(page.getByTestId('steps').locator('[aria-current="step"]')).toContainText('behind the standing part');

  await page.getByRole('button', { name: 'Previous' }).click();
  expect(await reached(page)).toBeCloseTo(STOPS[0]!, 1);
});

test('plays every step to the finished knot, faster when asked', async ({ page }) => {
  await page.getByLabel('Speed').selectOption('2');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Pause');
  await expect.poll(() => reached(page), { timeout: 25_000 }).toBeCloseTo(STOPS[2]!, 1);
  await expect(page.getByTestId('play')).toHaveText('Play');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('plays the step that is chosen, from where it begins', async ({ page }) => {
  await page.getByTestId('steps').getByRole('button').nth(1).click();
  await expect.poll(() => reached(page), { timeout: 15_000 }).toBeCloseTo(STOPS[1]!, 1);
  await expect(page.getByTestId('steps').locator('[aria-current="step"]')).toContainText('behind the standing part');
});

test('draws as much rope as has been laid, and its diagram with the strands passed so far', async ({ page }) => {
  await expect.poll(() => triangles(page)).toBeGreaterThan(200);
  const atStart = await triangles(page);
  await progress(page).fill('64.05');
  await expect.poll(() => triangles(page)).toBeGreaterThan(3 * atStart);

  await page.getByRole('button', { name: 'Diagram' }).click();
  const numbers = page.getByTestId('diagram').locator('.diagram__label');
  await expect(numbers).toHaveText(['1', '2', '3', '4']);
  await progress(page).fill('40');
  await expect(numbers).toHaveText(['1']);
  await progress(page).fill('20');
  await expect(numbers).toHaveCount(0);
});

test('shows a step done at once when the person has asked for less movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Next' }).click();
  expect(await reached(page)).toBeCloseTo(STOPS[0]!, 1);
  await expect(page.getByTestId('play')).toHaveText('Play');
});

test('gives the steps in Spanish', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Cómo se ata');
  await expect(page.getByTestId('steps').getByRole('button').first()).toHaveText(
    'Lleva el chicote alrededor y por encima del firme para formar un bucle.',
  );
  await expect(page.getByTestId('play')).toHaveText('Reproducir');
});

test('shows the rope, the buttons and every step on one screen of a laptop', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 900, 'on a narrow screen the panel goes under the view');
  const edges = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top + window.scrollY), bottom: Math.round(box.bottom + window.scrollY) };
    });
  const [view, panel] = [await edges('.rope-view'), await edges('.panel')];
  expect(panel.bottom).toBeLessThanOrEqual(viewport?.height ?? 0);
  expect(panel).toEqual(view);
});

test('has no accessibility violations that axe can detect', async ({ page }) => {
  await page.getByRole('button', { name: 'Next' }).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
