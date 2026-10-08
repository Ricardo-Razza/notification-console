import { test, expect } from '@playwright/test';
test('layout geometry', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill('admin@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('SmokePassword123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole('heading', { name: 'Envios ao longo do tempo' }).scrollIntoViewIfNeeded();
  await expect(page.locator('svg.graph')).toBeVisible();
  const drawer = await page.locator('mat-sidenav').boundingBox();
  expect(drawer?.width).toBe(250);
  const heading = await page.locator('h1').boundingBox();
  expect(heading?.x).toBeGreaterThanOrEqual(250);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: info.outputPath('wide.png'), fullPage: true });
});
