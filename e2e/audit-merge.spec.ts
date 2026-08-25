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

test('the suite strip is gone: one navigation row, not two', async ({ page }) => {
  // Until 2026-08-25 a four-tab strip (Audit / Transcript / Cross-document /
  // Documents) sat above the Read/Create/Ask pill, so the page carried two
  // stacked navigation systems. Both rooms folded into modes and the strip
  // went with them.
  await page.goto('/audit');

  await expect(page.locator('nav[aria-label="Audit tools"]')).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Audit mode"]')).toBeVisible();
});

test('Ask holds both entrances, and the retired rooms redirect into them', async ({ page }) => {
  await page.goto('/audit?mode=question');
  const askNav = page.locator('nav[aria-label="Ask input"]');
  await expect(askNav.getByRole('link', { name: 'I have a question' })).toBeVisible();
  await expect(askNav.getByRole('link', { name: 'I have the documents' })).toBeVisible();

  // The cross-document room is now the second entrance, and its worked example
  // came with it rather than being dropped.
  await page.goto('/creator/studio/cross-document');
  await expect(page).toHaveURL(/\/audit\?mode=question&ask=documents$/);
  await expect(page.getByText('Worked example', { exact: false })).toBeVisible();

  // The transcript room is replaced by segment-then-audit inside Read.
  await page.goto('/creator/studio/transcript');
  await expect(page).toHaveURL(/\/audit$/);
});

test('a YouTube link is offered to segmentation, not to the article extractor', async ({ page }) => {
  await page.goto('/audit');
  const field = page.getByLabel('Argument text or URL to audit');
  await field.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  // The paywall caveat belongs to page fetching and would be a lie here.
  await expect(page.getByText(/captions are read and mapped/)).toBeVisible();
  await expect(page.getByText(/Paywalled articles/)).toHaveCount(0);
});
