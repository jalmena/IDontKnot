import { expect, test } from '@playwright/test';

test('keeps the images of a rope in the browser, and does not compute them again on the next visit', async ({
  page,
}) => {
  await page.goto('/lab?rope=full');
  const canvas = page.getByTestId('rope-canvas');
  await expect(canvas).toHaveAttribute('data-images', 'computed', { timeout: 30_000 });

  // the browser finishes keeping them a moment after they are drawn: until then a visit computes them again
  await expect(async () => {
    await page.reload();
    await expect(canvas).toHaveAttribute('data-images', /kept|computed/, { timeout: 30_000 });
    await expect(canvas).toHaveAttribute('data-images', 'kept', { timeout: 1 });
  }).toPass({ timeout: 90_000 });
});

test('serves the files of the build so that the browser keeps them', async ({ page, request }) => {
  await page.goto('/lab');
  const script = await page.locator('script[type="module"][src^="/assets/"]').first().getAttribute('src');
  const headers = (await request.get(script ?? '')).headers();
  expect(headers['cache-control']).toBe('public, max-age=31536000, immutable');
  expect((await request.get('/lab')).headers()['cache-control']).toBe('no-cache');
});
