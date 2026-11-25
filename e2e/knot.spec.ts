import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Where each step of tying the figure-eight knot leaves the end of the rope. */
const STOPS = [37.795, 47.786, 64.039];
const progress = (page: Page) => page.getByTestId('progress');
const reached = async (page: Page) => Number(await progress(page).inputValue());
const triangles = async (page: Page) => Number(await page.getByTestId('rope-canvas').getAttribute('data-triangles'));
const steps = (page: Page) => page.getByTestId('steps');

test.beforeEach(async ({ page }) => {
  await page.goto('/knots/figure-eight');
  // the shape is the stored diagram, keeps the rules of geometry, and its steps follow from one another
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
});

test('opens the figure-eight knot tied, with its parts and how it is tied on one tab', async ({ page }) => {
  await expect(page).toHaveTitle('IDontKnot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  await expect(page.getByRole('link', { name: 'Knots', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('tab', { name: 'The knot' })).toHaveAttribute('aria-selected', 'true');

  await expect(page.getByTestId('parts').getByRole('button')).toHaveText([
    'Standing part',
    'First loop',
    'Second loop',
    'Tail',
  ]);
  await expect(steps(page).getByRole('button')).toHaveText([
    'Lead the end round and over the standing part, to make a loop.',
    'Take it round behind the standing part.',
    'Pass it down through the loop: over its near side, and out under its far side.',
  ]);
  // nothing is being done: the knot is whole
  await expect(steps(page).locator('[aria-current]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  expect(await reached(page)).toBeCloseTo(STOPS[2]!, 1);
  await expect(page.getByTestId('verdict')).toHaveCount(0);
});

test('shows what the core computes on the tab for mathematics', async ({ page }) => {
  await expect(page.getByTestId('facts')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Mathematics' }).click();
  await expect(page.getByTestId('crossings')).toHaveText('4');
  await expect(page.getByTestId('jones-closure')).toHaveAttribute('aria-label', 't^(-2) − t^(-1) + 1 − t + t^2');
  await expect(page.getByTestId('parts')).toHaveCount(0);

  // the arrow keys move between the tabs
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'The knot' })).toBeFocused();
  await expect(page.getByTestId('parts')).toBeVisible();
});

test('draws the open rope with its parts named, and its diagram in its place when asked', async ({ page }) => {
  await expect.poll(() => triangles(page)).toBeGreaterThan(1000);
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

test('plays the step that is chosen from where it begins, then one step at a time, and goes back', async ({ page }) => {
  await steps(page).getByRole('button').first().click();
  await expect.poll(() => reached(page), { timeout: 15_000 }).toBeCloseTo(STOPS[0]!, 1);
  await expect(steps(page).locator('[aria-current="step"]')).toContainText('to make a loop');
  // while the knot is being tied, the rope has the names of the parts laid so far, and of its end
  await expect(page.locator('.rope-view__names .tag')).toHaveText(['Standing part', 'First loop', 'The end']);

  await page.getByRole('button', { name: 'Next' }).click();
  await expect.poll(() => reached(page), { timeout: 15_000 }).toBeCloseTo(STOPS[1]!, 1);
  await expect(steps(page).locator('[aria-current="step"]')).toContainText('behind the standing part');

  await page.getByRole('button', { name: 'Previous' }).click();
  expect(await reached(page)).toBeCloseTo(STOPS[0]!, 1);
});

test('plays every step from the start to the finished knot, faster when asked', async ({ page }) => {
  await page.getByLabel('Speed').selectOption('2');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Pause');
  // the knot was tied: playing begins again with the rope laid only as far as its standing part
  await expect.poll(() => reached(page)).toBeLessThan(STOPS[0]!);
  await expect.poll(() => reached(page), { timeout: 25_000 }).toBeCloseTo(STOPS[2]!, 1);
  await expect(page.getByTestId('play')).toHaveText('Play');
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  // tied again, the rope has the names of its parts
  await expect(page.locator('.rope-view__names .tag')).toHaveCount(4);
});

test('draws as much rope as has been laid, and its diagram with the strands passed so far', async ({ page }) => {
  await expect.poll(() => triangles(page)).toBeGreaterThan(1000);
  const whole = await triangles(page);
  await progress(page).fill('12');
  await expect.poll(() => triangles(page)).toBeLessThan(whole / 3);

  await page.getByRole('button', { name: 'Diagram' }).click();
  const numbers = page.getByTestId('diagram').locator('.diagram__label');
  await expect(numbers).toHaveCount(0);
  await progress(page).fill('40');
  await expect(numbers).toHaveText(['1']);
  await progress(page).fill('64.05');
  await expect(numbers).toHaveText(['1', '2', '3', '4']);
});

test('tightens the knot when asked, and loosens it again', async ({ page }) => {
  const button = page.getByTestId('tighten');
  const names = page.locator('.rope-view__names .tag');
  await expect(button).toHaveText('Tighten');
  await expect(names).toHaveCount(4);
  await expect.poll(() => triangles(page)).toBeGreaterThan(1000);

  await button.click();
  await expect(button).toHaveText('Loosen');
  // tight, the rope is another shape: the names of its parts belong to the shape it was tied in
  await expect(names).toHaveCount(0);
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '1', { timeout: 15_000 });

  // going back a step loosens it, as the button does
  await page.getByRole('button', { name: 'Previous' }).click();
  await expect(button).toHaveText('Tighten');
  await expect(names).toHaveCount(4, { timeout: 15_000 });
  expect(await reached(page)).toBeCloseTo(STOPS[2]!, 1);

  // a knot that is not tied yet cannot be tightened
  await progress(page).fill('30');
  await expect(button).toBeDisabled();
  // the slider moved to its far end is the knot tied, though the end of the rope is not on one of its steps
  await progress(page).fill('64');
  await expect(button).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await expect(names).toHaveCount(4);
});

test('is loose at once when a tight knot is tied again', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('tighten').click();
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '1');
  await steps(page).getByRole('button').first().click();
  await expect(page.getByTestId('tighten')).toHaveText('Tighten');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '0');
  expect(await reached(page)).toBeCloseTo(STOPS[0]!, 1);
});

test('shows a step done at once when the person has asked for less movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await steps(page).getByRole('button').first().click();
  expect(await reached(page)).toBeCloseTo(STOPS[0]!, 1);
  await expect(page.getByTestId('play')).toHaveText('Play');
});

test('shows the knot, its panel and the row of knots on one screen of a laptop', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 900, 'on a narrow screen the panel goes under the view');
  const edges = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top + window.scrollY), bottom: Math.round(box.bottom + window.scrollY) };
    });
  const [view, panel, row] = [await edges('.rope-view'), await edges('.panel'), await edges('.shelf')];
  // side by side, the view and the panel are one height; the row of knots is under them, on the same screen
  expect(panel).toEqual(view);
  expect(row.top).toBeGreaterThan(panel.bottom);
  expect(row.bottom).toBeLessThanOrEqual(viewport?.height ?? 0);
});

test('names the knot, its parts and its steps in Spanish', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nudo de ocho');
  await expect(page.getByRole('tab')).toHaveText(['El nudo', 'Matemáticas']);
  await expect(page.getByTestId('parts').getByRole('button')).toHaveText([
    'Firme',
    'Primer bucle',
    'Segundo bucle',
    'Chicote',
  ]);
  await expect(steps(page).getByRole('button').first()).toHaveText(
    'Lleva el chicote alrededor y por encima del firme para formar un bucle.',
  );
  await expect(page.getByTestId('play')).toHaveText('Reproducir');
});

test('goes to the laboratory and back without loading the application again', async ({ page }) => {
  await page.evaluate(() => ((window as unknown as { marker: boolean }).marker = true));
  await page.getByRole('link', { name: 'Laboratory' }).click();
  await expect(page).toHaveURL(/\/lab$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Torus knot laboratory');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Figure-eight knot');
  expect(await page.evaluate(() => (window as unknown as { marker?: boolean }).marker)).toBe(true);
});

test('says so when there is no such knot or page, and leads back to the library', async ({ page }) => {
  await page.goto('/knots/no-such-knot');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is no such knot in the library.');
  await page.goto('/some/deep/link');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('There is nothing at this address.');
  await page.getByRole('link', { name: 'Go to the library' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Knots');
});

test('has no accessibility violations that axe can detect, on either tab', async ({ page }) => {
  await page.getByTestId('parts').getByRole('button', { name: 'Tail' }).click();
  await steps(page).getByRole('button').nth(1).click();
  const violations = async () =>
    (await new AxeBuilder({ page }).analyze()).violations.map((violation) => `${violation.id}: ${violation.help}`);
  expect(await violations()).toEqual([]);
  await page.getByRole('tab', { name: 'Mathematics' }).click();
  await expect(page.getByTestId('facts')).toBeVisible();
  expect(await violations()).toEqual([]);
});
