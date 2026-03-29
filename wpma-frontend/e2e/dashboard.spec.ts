import { test, expect } from '@playwright/test';

test('dashboard requires authentication', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForURL(/\/(auth\/login|login)/, { timeout: 10000 });
  await expect(page).toHaveURL(/login/);
});

test('dashboard loads for authenticated user', async ({ page }) => {
  const token = process.env.E2E_TEST_TOKEN || 'test-token';
  await page.goto('/auth/login');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
    localStorage.setItem('wpma-auth', JSON.stringify({ state: { token: t, isAuthenticated: true } }));
  }, token);
  await page.goto('/dashboard');
  await expect(page.locator('main, [role="main"], .dashboard, #dashboard').first()).toBeVisible({ timeout: 10000 });
});
