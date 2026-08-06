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

  // The audited external takes (Piece 3) render. Match the section kicker
  // exactly - evidence-note prose may also contain the words "Other takes"
  // (e.g. "audited briefly under Other takes"), which breaks a bare
  // substring locator under strict mode.
  await expect(page.getByText('Other takes · audited')).toBeVisible();

  // Editor's-read leader: verdict's first sentence surfaces under the lede,
  // anchored to the full editor's view.
  await expect(page.getByText('Our read')).toBeVisible();
  const leaderLink = page.getByRole('link', { name: /full editor's view/i });
  await expect(leaderLink).toHaveAttribute('href', '#discussion');

  // ONE Sources section (positions + further evidence), not two competing
  // bibliographies; the old "Evidence cited" label is gone.
  await expect(page.locator('#sources').getByText('Sources', { exact: true })).toBeVisible();
  await expect(page.getByText(/Evidence cited/)).toHaveCount(0);

  // CTA budget: per-audit chips plus exactly one footer CTA into the tool.
  await expect(page.getByText('Audit a similar argument')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /how the audit works/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /open the audit/i })).toHaveCount(1);
});

test('explainer renders the pared chassis: essay + one related link only', async ({ page }) => {
  await page.goto('/briefing/begging-the-question');
  await expect(page.getByText('Explainer', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Deeper reading')).toHaveCount(0);

  // No briefing apparatus: no ToC, no share/cite rail, no audit CTAs.
  await expect(page.getByText('On this page')).toHaveCount(0);
  await expect(page.getByText('Cite this Briefing')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /open the audit/i })).toHaveCount(0);

  // One related-briefing link closes the essay.
  await expect(page.getByText('Related briefing', { exact: true })).toBeVisible();
});
