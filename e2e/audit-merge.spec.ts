import { test, expect } from '@playwright/test';

// The merged Read/Create/Ask surface at /audit ("Workbench + satellites",
// adjudicated 2026-07-13, shipped 2026-07-19; Ask joined 2026-08-17). The mode
// switch is SERVER-side (?mode= renders a different island), so every check
// asserts server-rendered structure - zero LLM cost, no route mocks needed.

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

test('question mode: the Ask tab is reachable from the default view and renders the box', async ({ page }) => {
  // The third way in has to be findable from where visitors actually land, so
  // the check starts on the default view and clicks rather than deep-linking.
  await page.goto('/audit');

  const modeNav = page.locator('nav[aria-label="Audit mode"]');
  const askTab = modeNav.getByRole('link', { name: /ask/i });
  await expect(askTab).toBeVisible();
  await askTab.click();

  await expect(page).toHaveURL(/\/audit\?mode=question$/);
  await expect(modeNav.getByRole('link', { name: /ask/i })).toHaveAttribute('aria-current', 'page');

  // The question field, and the run control that only an explicit click fires.
  const field = page.getByLabel('Your contested question');
  await expect(field).toBeVisible();
  const run = page.getByRole('button', { name: /build the briefing for this question/i });
  await expect(run).toBeDisabled();

  // 15 characters is the floor; below it the button stays dead and says why.
  await field.fill('too short');
  await expect(run).toBeDisabled();
  await expect(page.getByText(/type the whole question/i)).toBeVisible();

  await field.fill('Is nuclear cheaper than renewables for Australia?');
  await expect(run).toBeEnabled();
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
