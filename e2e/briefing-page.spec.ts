import { test, expect } from '@playwright/test';

// The prerendered briefing surface: question heading, the audit deep-link back
// to the reader, and the audited "other takes" block. Zero API cost (static HTML).
test('briefing page renders question, audit link, and takes', async ({ page }) => {
  await page.goto('/briefing/minimum-wage-jobs');

  await expect(page.getByRole('heading', { name: /minimum wage/i })).toBeVisible();

  // "Audit this argument →" deep-links into the tool at /audit with the
  // briefing slug + position id (D1 Option B, 2026-07-07: the tool moved off
  // the homepage; per-position links carry the exact assessed text).
  const auditLink = page.getByRole('link', { name: /audit this argument/i }).first();
  await expect(auditLink).toBeVisible();
  await expect(auditLink).toHaveAttribute('href', /^\/audit\?audit=/);

  // The audited external takes (Piece 3) render.
  await expect(page.getByText('Other takes')).toBeVisible();
});

test('explainer renders without a spectrum or deeper-reading shelf', async ({ page }) => {
  await page.goto('/briefing/begging-the-question');
  await expect(page.getByText('Explainer', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Deeper reading')).toHaveCount(0);
});
