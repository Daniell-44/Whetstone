import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBriefingFile, validateBriefing } from '../../functions/_lib/briefing/parse';
import { CATEGORY_COLOUR } from '../../src/lib/category-colour';

// ---------------------------------------------------------------------------
// The scaffolder must emit something that parses and validates clean.
//
// A scaffold that drifts from the format is worse than none: it teaches the
// wrong shape, and the author only finds out in a build log they are not
// watching. This generates both formats for real and runs them through the
// actual parser and validator.
// ---------------------------------------------------------------------------

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR  = join(ROOT, 'src', 'content', 'briefings');

function scaffold(slug: string, explainer: boolean): string {
  const args = ['tsx', 'scripts/new-briefing.ts'];
  if (explainer) args.push('--explainer');
  args.push(slug, explainer ? 'What something actually means' : 'Is the question contested?');
  execFileSync('npx', args, { cwd: ROOT, stdio: 'pipe' });
  return readFileSync(join(DIR, `${slug}.md`), 'utf8');
}

function cleanup(slug: string) {
  const p = join(DIR, `${slug}.md`);
  if (existsSync(p)) rmSync(p);
}

describe('pnpm new:explainer', () => {
  const slug = 'zz-scaffold-test-explainer';
  afterEach(() => cleanup(slug));

  it('emits an explainer that parses and validates with no warnings', () => {
    const raw = scaffold(slug, true);
    const b   = parseBriefingFile(raw, slug);
    expect(b.kind).toBe('explainer');
    expect(validateBriefing(b)).toEqual([]);
  });

  it('emits a real category, not a placeholder', () => {
    // `category: TODO` would have published a card whose coloured tick read
    // "TODO" — the category falls back to grey with no warning at all.
    const b = parseBriefingFile(scaffold(slug, true), slug);
    expect(Object.keys(CATEGORY_COLOUR)).toContain(b.category);
  });

  it('keeps its hint comments out of the values', () => {
    // The frontmatter parser takes EVERYTHING after the colon, so a trailing
    // `# one of: …` would become part of the category.
    const b = parseBriefingFile(scaffold(slug, true), slug);
    expect(b.category).not.toContain('#');
    expect(b.question).not.toContain('#');
  });

  it('carries no sourcing apparatus — that is the whole point of the format', () => {
    const raw = scaffold(slug, true);
    expect(raw).not.toContain('::positions');
    expect(raw).not.toContain('::evidence');
    expect(raw).not.toContain('::audit');
  });
});

describe('pnpm new:briefing', () => {
  const slug = 'zz-scaffold-test-briefing';
  afterEach(() => cleanup(slug));

  it('still emits a briefing that parses and validates with no warnings', () => {
    const b = parseBriefingFile(scaffold(slug, false), slug);
    expect(b.kind ?? 'briefing').toBe('briefing');
    expect(validateBriefing(b)).toEqual([]);
  });

  it('emits a real category here too', () => {
    const b = parseBriefingFile(scaffold(slug, false), slug);
    expect(Object.keys(CATEGORY_COLOUR)).toContain(b.category);
  });

  it('uses the v2 source model, never the retired single table', () => {
    const raw = scaffold(slug, false);
    expect(raw).toContain('::positions');
    expect(raw).toContain('::evidence');
    expect(raw).not.toContain('::sources');
  });
});
