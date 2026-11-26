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
  await expect(page.getByRole('tab', { name: 'Use' })).toBeFocused();
  await page.keyboard.press('Home');
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

test('feeds the rope along the way of the knot, and draws its diagram with the strands passed so far', async ({
  page,
}) => {
  await expect.poll(() => triangles(page)).toBeGreaterThan(1000);
  // where the name of the end is written tells how far the end has been led
  const end = () =>
    page.locator('.rope-view__names .tag--marked').evaluate((tag: HTMLElement) => `${tag.style.left} ${tag.style.top}`);
  await progress(page).fill('12');
  await expect(page.locator('.rope-view__names .tag--marked')).toHaveText('The end');
  const early = await end();
  await expect.poll(() => triangles(page)).toBeGreaterThan(200);
  // the end goes forward along the way of the knot, and the rope behind it is still drawn
  await progress(page).fill('30');
  await expect.poll(end).not.toBe(early);
  await expect.poll(() => triangles(page)).toBeGreaterThan(200);

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

test('keeps the view as the person has turned it, through tightening, loosening and another rope', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => triangles(page)).toBeGreaterThan(1000);
  // where the name of a part is written tells from where the knot is seen
  const where = () =>
    page
      .locator('.rope-view__names .tag')
      .nth(1)
      .evaluate((tag: HTMLElement) => `${tag.style.left} ${tag.style.top}`);
  const front = await where();

  const box = await page.getByTestId('rope-canvas').boundingBox();
  if (!box) throw new Error('the view is drawn');
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y - 45, { steps: 8 });
  await page.mouse.up();
  await expect.poll(where).not.toBe(front);
  const turned = await where();

  const panel = page.getByTestId('panel');
  await page.getByTestId('tighten').click();
  await expect(panel).toHaveAttribute('data-tightened', '1');
  await page.getByTestId('tighten').click();
  await expect(panel).toHaveAttribute('data-tightened', '0');
  await expect.poll(where).toBe(turned);

  await page.getByLabel('Material').selectOption('sisal');
  await expect.poll(() => triangles(page)).toBeGreaterThan(1000);
  expect(await where()).toBe(turned);

  // only when asked is the knot seen from the front again
  await page.getByRole('button', { name: 'Reset the view' }).click();
  await expect.poll(where).toBe(front);
});

test('shows a step done at once when the person has asked for less movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await steps(page).getByRole('button').first().click();
  expect(await reached(page)).toBeCloseTo(STOPS[0]!, 1);
  await expect(page.getByTestId('play')).toHaveText('Play');
});

test('shows each knot, its panel and the row of knots on one screen of a laptop', async ({ page, viewport }) => {
  test.skip((viewport?.width ?? 0) < 900, 'on a narrow screen the panel goes under the view');
  const edges = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: Math.round(box.top + window.scrollY), bottom: Math.round(box.bottom + window.scrollY) };
    });
  // the figure-eight loop has the most steps, six: they scroll beside the view
  for (const knot of [
    'figure-eight',
    'overhand',
    'bowline',
    'double-overhand',
    'clove-hitch',
    'larks-head',
    'figure-eight-loop',
  ]) {
    for (const language of ['en', 'es']) {
      await page.goto(`/knots/${knot}`);
      await page.getByLabel(/Language|Idioma/).selectOption(language);
      await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
      const [view, panel, row] = [await edges('.rope-view'), await edges('.panel'), await edges('.shelf')];
      // side by side, the view and the panel are one height; the row of knots is under them, on the same screen
      expect(panel, `${knot} in ${language}`).toEqual(view);
      expect(row.top).toBeGreaterThan(panel.bottom);
      expect(row.bottom, `${knot} in ${language}`).toBeLessThanOrEqual(viewport?.height ?? 0);
    }
  }
  // the step being tied is kept in sight among them
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const steps = page.getByTestId('steps');
  await steps.getByRole('button').first().click();
  for (let step = 0; step < 4; step++) await page.getByRole('button', { name: /^(Next|Siguiente)$/ }).click();
  const current = steps.locator('[aria-current="step"]');
  await expect(current).toHaveCount(1);
  expect(await steps.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
  const [list, item] = [await steps.boundingBox(), await current.boundingBox()];
  expect(item!.y).toBeGreaterThanOrEqual(list!.y - 1);
  expect(item!.y + item!.height).toBeLessThanOrEqual(list!.y + list!.height + 1);
});

test('says what the knot is for in the discipline, and shows what it is tied to', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'nautical'));
  await page.goto('/knots/figure-eight');
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(page.getByTestId('category')).toHaveText('Stopper knot');
  await expect(page.getByTestId('use')).toContainText('A stopper at the end of a sheet');
  // what it is for ends with whether it jams after a load
  await expect(page.getByTestId('use')).toHaveText(
    / It is bulkier than the overhand knot\. After a heavy load it tightens/,
  );
  // and then what to take care of with it, in a section of its own
  await expect(page.getByTestId('cautions')).toContainText('Leave a tail beyond it');
  const canvas = page.getByTestId('rope-canvas');
  await expect(canvas).toHaveAttribute('data-objects', '');
  const show = page.getByRole('button', { name: 'Show the plate' });
  await show.click();
  await expect(show).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-objects', 'plate');
  // it stays while the knot is tightened, and goes when asked
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'The knot' }).click();
  await page.getByTestId('tighten').click();
  await expect(canvas).toHaveAttribute('data-objects', 'plate');
  await page.getByRole('tab', { name: 'Use' }).click();
  await page.getByRole('button', { name: 'Show the plate' }).click();
  await expect(canvas).toHaveAttribute('data-objects', '');

  // an eye is shown round a post
  await page.goto('/knots/bowline');
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(page.getByTestId('category')).toHaveText('Loop');
  await page.getByRole('button', { name: 'Show the post' }).click();
  await expect(canvas).toHaveAttribute('data-objects', 'post');

  // a knot that a discipline does not use says so, and has nothing to show
  await page.goto('/knots/overhand');
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(page.getByTestId('use')).toHaveText(
    'The library records no use of this knot in Nautical. After it has taken a load it can jam so tight that it is hard to untie.',
  );
  await expect(page.getByTestId('show-object')).toHaveCount(0);

  // in knot theory nothing pulls on it
  await page.getByTestId('discipline').selectOption('theory');
  await page
    .getByRole('navigation', { name: 'All knots' })
    .getByRole('link', { name: 'Overhand knot', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(page.getByTestId('use')).toContainText('the trefoil knot');
  await expect(page.getByTestId('use')).not.toContainText('load');
  await expect(page.getByTestId('cautions')).toHaveCount(0);
});

test('makes no claim about what knot a rope would be whose end lies inside it, as in a bowline', async ({ page }) => {
  await page.goto('/knots/bowline');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
  await expect(page.getByTestId('parts').getByRole('button')).toHaveText([
    'Standing part',
    'Small loop',
    'Eye',
    'Collar',
    'Tail',
  ]);
  await expect(page.getByTestId('steps').getByRole('button')).toHaveCount(4);
  await page.getByRole('tab', { name: 'Mathematics' }).click();
  await expect(page.getByTestId('crossings')).toHaveText('7');
  // its tail is inside its eye: joined outside the knot it cannot be, but over the whole knot or under it
  await expect(page.getByTestId('facts')).toContainText('Both ends lie outside the knotno');
  await expect(page.getByTestId('jones-closure')).toHaveCount(0);
  const [over, under] = [page.getByTestId('jones-over'), page.getByTestId('jones-under')];
  await expect(over).toHaveAttribute('aria-label', /t/);
  await expect(under).toHaveAttribute('aria-label', /t/);
  expect(await over.getAttribute('aria-label')).not.toBe(await under.getAttribute('aria-label'));
});

test('names the knot, its parts and its steps in Spanish', async ({ page }) => {
  await page.getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nudo de ocho');
  await expect(page.getByRole('tab')).toHaveText(['El nudo', 'Utilidad', 'Matemáticas']);
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
  // with no discipline chosen yet, the library begins with the disciplines
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Disciplines');
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

test('shows a knot tied round a post round its own post when asked, and says that alone its rope is not knotted', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'nautical'));
  await page.goto('/knots/clove-hitch');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
  const canvas = page.getByTestId('rope-canvas');
  const posts = page.getByTestId('diagram').locator('polyline[stroke="#9b6a3c"]');
  // until it is asked for, there is no post, on the view or on the diagram
  await expect(canvas).toHaveAttribute('data-objects', '');
  await page.getByRole('button', { name: 'Diagram' }).click();
  await expect(posts).toHaveCount(0);
  await page.getByRole('button', { name: '3D' }).click();
  await page.getByRole('tab', { name: 'Use' }).click();
  await page.getByRole('button', { name: 'Show the post' }).click();
  await expect(canvas).toHaveAttribute('data-objects', 'post');
  await page.getByRole('tab', { name: 'Mathematics' }).click();
  await expect(page.getByTestId('jones-alone')).toHaveText('1');
  // drawn tight, it stays where it is
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('tab', { name: 'The knot' }).click();
  await page.getByTestId('tighten').click();
  await expect(page.getByTestId('panel')).toHaveAttribute('data-tightened', '1');
  await expect(canvas).toHaveAttribute('data-objects', 'post');
  // and on the diagram it is drawn as a post, not as rope (a straight upright line has no width to be seen
  // by, so it is counted)
  await page.getByRole('button', { name: 'Diagram' }).click();
  await expect(posts).not.toHaveCount(0);
});

test('shows an eye through a ring of metal, and a lark’s head round the strands of the rope before', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'climbing'));
  await page.goto('/knots/figure-eight-loop');
  await page.getByRole('tab', { name: 'Use' }).click();
  // the sections, in their order, and the last of them only where there is something to show
  await expect(page.getByTestId('panel').getByRole('heading', { level: 2 })).toHaveText([
    'Category',
    'What it is for',
    'Cautions',
    'In use',
  ]);
  const canvas = page.getByTestId('rope-canvas');
  await page.getByRole('button', { name: 'Show the ring' }).click();
  await expect(canvas).toHaveAttribute('data-objects', 'ring');
  // a ring is metal: it has no wood to wait for
  await expect(canvas).toHaveAttribute('data-wood', '');

  await page.getByTestId('discipline').selectOption('shibari');
  await page.getByRole('navigation', { name: 'All knots' }).getByRole('link', { name: "Lark's head" }).click();
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(canvas).toHaveAttribute('data-ropes', '1');
  await page.getByRole('button', { name: 'Show the other rope' }).click();
  // its two strands, drawn as rope where the post would stand, and no post
  await expect(canvas).toHaveAttribute('data-ropes', '3');
  await expect(canvas).toHaveAttribute('data-objects', '');

  // a knot with nothing to show has no such section
  await page
    .getByRole('navigation', { name: 'All knots' })
    .getByRole('link', { name: 'Overhand knot', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(page.getByTestId('panel').getByRole('heading', { level: 2 })).toHaveText([
    'Category',
    'What it is for',
    'Cautions',
  ]);
});

test('shows a lashing round its two poles when asked', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('idk.discipline', 'pioneering'));
  await page.goto('/knots/square-lashing');
  await expect(page.getByTestId('panel')).toHaveAttribute('data-checked', 'ok');
  const canvas = page.getByTestId('rope-canvas');
  await expect(canvas).toHaveAttribute('data-objects', '');
  // a lashing is drawn tight turn by turn as it is tied, not afterwards
  await expect(page.getByTestId('play')).toBeVisible();
  await expect(page.getByTestId('tighten')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Use' }).click();
  await expect(page.getByTestId('category')).toHaveText('Lashing');
  await page.getByRole('button', { name: 'Show the poles' }).click();
  await expect(canvas).toHaveAttribute('data-objects', 'post post');
});
