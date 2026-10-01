import { test, expect } from '@playwright/test';

test('create, save, restore, and export a physics scene', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const sceneAction = async (name: string) => {
    await page.getByRole('button', { name: 'Scene options', exact: true }).click();
    await page.getByRole('button', { name: new RegExp('^' + name) }).click();
  };
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Scene', { exact: true }).selectOption('empty');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByTitle('Circle (2)', { exact: true }).click();
  const bounds = await page.locator('canvas').boundingBox();
  await page.locator('canvas').click({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect(page.getByTestId('body-count')).toHaveText('1 body');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Gravity', { exact: true }).fill('0');
  await sceneAction('Save scene');
  await page.getByLabel('Scene', { exact: true }).selectOption('garden');
  await sceneAction('Restore saved scene');
  await expect(page.getByTestId('body-count')).toHaveText('1 body');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Gravity', { exact: true })).toHaveValue('0');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeFocused();
  // A reset must not silently restore engine gravity while the slider stays zero.
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kinetic.scene.v1')!).bodies[0].y,
  );
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await sceneAction('Save scene');
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem('kinetic.scene.v1')!).bodies[0].y,
  );
  expect(Math.abs(after - before)).toBeLessThan(0.01);
  const download = page.waitForEvent('download');
  await sceneAction('Export JSON');
  expect((await download).suggestedFilename()).toBe('kinetic-scene.json');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Gravity', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

test('invalid scene import preserves the running scene', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-ready', 'true');
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":9}'),
  });
  await expect(page.locator('.stage-bottom [role=status]')).toContainText('Could not load scene');
  await expect(page.getByTestId('body-count')).toHaveText('27 bodies');
});

test('edit history restores bodies, velocities and environment and clears a redo branch', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Scene', { exact: true }).selectOption('empty');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByTitle('Circle (2)', { exact: true }).click();
  const canvas = page.locator('canvas'),
    bounds = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: bounds.width * 0.4, y: bounds.height * 0.4 } });
  await canvas.click({ position: { x: bounds.width * 0.6, y: bounds.height * 0.4 } });
  await expect(page.getByTestId('body-count')).toHaveText('2 bodies');
  const save = async () => {
    await page.getByRole('button', { name: 'Scene options', exact: true }).click();
    await page.getByRole('button', { name: /^Save scene/ }).click();
    return page.evaluate(() => JSON.parse(localStorage.getItem('kinetic.scene.v1')!));
  };
  const before = await save();
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await expect(page.getByTestId('body-count')).toHaveText('1 body');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('body-count')).toHaveText('2 bodies');
  const after = await save();
  expect(after.bodies).toEqual(before.bodies);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Gravity', { exact: true }).fill('0');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Gravity', { exact: true })).toHaveValue('760');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Undo edit', exact: true }).click();
  await canvas.click({ position: { x: bounds.width * 0.7, y: bounds.height * 0.5 } });
  await expect(page.getByRole('button', { name: 'Redo edit', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
});
