import { test, expect } from '@playwright/test';

test('create, save, restore, and export a physics scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('C++ engine ready', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Blank canvas/ }).click();
  await page.getByRole('button', { name: /Pause/ }).click();
  await page.getByTitle('Circle (2)', { exact: true }).click();
  await page.locator('canvas').click({ position: { x: 200, y: 150 } });
  await expect(page.locator('.big-metric strong')).toHaveText('1');
  await page.getByLabel('Gravity', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Save scene', exact: true }).click();
  await page.getByRole('button', { name: /Blank canvas/ }).click();
  await page.getByRole('button', { name: /Restore saved scene/ }).click();
  await expect(page.locator('.big-metric strong')).toHaveText('1');
  await expect(page.getByLabel('Gravity', { exact: true })).toHaveValue('0');
  // A reset must not silently restore engine gravity while the slider stays zero.
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kinetic.scene.v1')!).bodies[0].y,
  );
  await page.getByRole('button', { name: /Play/ }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /Pause/ }).click();
  await page.getByRole('button', { name: 'Save scene', exact: true }).click();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kinetic.scene.v1')!).bodies[0].y,
  );
  expect(Math.abs(after - before)).toBeLessThan(0.01);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export/ }).click();
  expect((await download).suggestedFilename()).toBe('kinetic-scene.json');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('invalid scene import preserves the running scene', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('C++ engine ready', { exact: true })).toBeVisible();
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":9}'),
    });
  await expect(page.locator('.stage-bottom [role=status]')).toContainText('Could not load scene');
  await expect(page.locator('.big-metric strong')).toHaveText('27');
});
