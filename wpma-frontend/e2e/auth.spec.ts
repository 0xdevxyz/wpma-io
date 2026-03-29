import { test, expect } from '@playwright/test';

test('login page loads', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test('login with invalid credentials shows error', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', 'invalid@example.com');
  await page.fill('input[type="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await expect(page.locator('text=/fehler|error|ungültig|invalid|falsch|incorrect/i').first()).toBeVisible({ timeout: 10000 });
});

test('successful login redirects to dashboard', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL || '';
  const password = process.env.E2E_TEST_PASSWORD || '';
  await page.goto('/auth/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await expect(page).toHaveURL(/\/dashboard/);
});
