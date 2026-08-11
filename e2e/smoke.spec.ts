import { expect, test } from '@playwright/test';

test('home redirects to dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { name: /trading dashboard/i })).toBeVisible();
});
