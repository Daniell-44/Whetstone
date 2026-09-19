import { test, expect } from '@playwright/test';

// The highest-value, hardest-to-unit-test flow: /?audit=<slug> assembles the
// briefing text server-side, passes it as a prop to the AuditForm island, and a
// useEffect pre-fills the textarea + shows a banner after hydration. None of
// that is reachable by the Node-environment Vitest suite.
//
// Locators are scoped to [data-tool-mode="read"]: since the 2026-09 merge both
// postures are mounted at once (the inactive one hidden so its buffer survives
// toggling), so an unscoped `textarea.first()` would be relying on DOM order.
test('briefing deep-link pre-fills the reader after hydration', async ({ page }) => {
  await page.goto('/?audit=minimum-wage-jobs');

  const textarea = page.locator('[data-tool-mode="read"] textarea').first();
  // useEffect runs post-hydration — wait for it to populate (>= 50 chars).
  await expect(textarea).toHaveValue(/[\s\S]{50,}/, { timeout: 10_000 });

  await expect(page.getByText('Loaded from a briefing')).toBeVisible();
  await expect(page.getByRole('button', { name: /Audit this argument/i })).toBeEnabled();
});

test('plain reader (no deep-link) starts empty', async ({ page }) => {
  // The tool lives at /audit since 2026-07-07 (the homepage is the publication
  // with a compact launcher input, not the audit textarea).
  await page.goto('/audit');
  const textarea = page.locator('[data-tool-mode="read"] textarea').first();
  await expect(textarea).toHaveValue('');
  await expect(page.getByText('Loaded from a briefing')).toHaveCount(0);
});
