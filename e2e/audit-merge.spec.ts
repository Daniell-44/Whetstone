import { test, expect } from '@playwright/test';

// The merged Read/Create surface at /audit ("Workbench + satellites",
// adjudicated 2026-07-13, shipped 2026-07-19). The mode switch is SERVER-side
// (?mode=create renders a different island), so all three checks assert
// server-rendered structure - zero LLM cost, no route mocks needed.

test('read mode: segmented control renders with Read active + audit textarea', async ({ page }) => {
  await page.goto('/audit');

  const modeNav = page.locator('nav[aria-label="Audit mode"]');
  const readTab = modeNav.getByRole('link', { name: /read/i });
  const createTab = modeNav.getByRole('link', { name: /create/i });

  await expect(readTab).toBeVisible();
  await expect(readTab).toHaveAttribute('aria-current', 'page');
  await expect(createTab).toBeVisible();
  await expect(createTab).not.toHaveAttribute('aria-current', 'page');

  // The Reader's paste box is present in Read mode.
  await expect(page.locator('textarea').first()).toBeVisible();
});

test('create mode signed-out: editor renders with a keep-your-work sign-in line', async ({ page }) => {
  await page.goto('/audit?mode=create');

  const modeNav = page.locator('nav[aria-label="Audit mode"]');
  await expect(modeNav.getByRole('link', { name: /create/i })).toHaveAttribute('aria-current', 'page');

  // The editor itself, not a gate (owner decision 2026-08-14: analysis is
  // free without an account; saving is the only thing that asks to sign in).
  await expect(page.locator('textarea').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /sign in free to keep this draft/i })).toBeVisible();
});

test('/creator/studio redirects into the merged surface, preserving ?doc=', async ({ page }) => {
  await page.goto('/creator/studio?doc=abc123');
  await expect(page).toHaveURL(/\/audit\?mode=create&doc=abc123$/);
});

test('tool strip shows Audit / Transcript / Cross-document / Documents', async ({ page }) => {
  await page.goto('/audit');

  const toolNav = page.locator('nav[aria-label="Audit tools"]');
  await expect(toolNav.getByRole('link', { name: 'Audit', exact: true })).toBeVisible();
  await expect(toolNav.getByRole('link', { name: /Transcript/ })).toBeVisible();
  await expect(toolNav.getByRole('link', { name: /Cross-document/ })).toBeVisible();
  await expect(toolNav.getByRole('link', { name: /^Documents$/ })).toBeVisible();
});
