import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const token = process.env.E2E_TEST_TOKEN || 'test-token';
  await page.goto('/auth/login');
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
    localStorage.setItem('wpma-auth', JSON.stringify({ state: { token: t, isAuthenticated: true } }));
  }, token);
});

test('sites page loads and shows site list', async ({ page }) => {
  await page.goto('/sites');
  await expect(page.locator('table, [role="table"], ul, ol, .site-list, .sites').first()).toBeVisible({ timeout: 10000 });
});

test('add site button is visible', async ({ page }) => {
  await page.goto('/sites');
  await expect(
    page.getByRole('button', { name: /add|neu|hinzufügen|neue seite|new site/i }).or(
      page.getByRole('link', { name: /add|neu|hinzufügen|neue seite|new site/i })
    ).first()
  ).toBeVisible({ timeout: 10000 });
});
