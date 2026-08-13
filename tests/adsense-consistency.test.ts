import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

// ads.txt and the page tag both carry the publisher ID. If they drift, ads stop
// serving and neither file looks wrong on its own, so the invariant is pinned
// here rather than left to whoever edits one of them next.
describe('AdSense publisher ID', () => {
  it('is identical in ads.txt and in the layout that loads the tag', () => {
    const adsTxt = readFileSync(join(ROOT, 'public/ads.txt'), 'utf-8');
    const base = readFileSync(join(ROOT, 'src/layouts/Base.astro'), 'utf-8');

    const fromAdsTxt = adsTxt.match(/google\.com,\s*(pub-\d+),\s*DIRECT/i)?.[1];
    const fromBase = base.match(/ca-(pub-\d+)/)?.[1];

    expect(fromAdsTxt, 'ads.txt has no google.com DIRECT line').toBeTruthy();
    expect(fromBase, 'Base.astro has no ca-pub- client').toBeTruthy();
    expect(fromAdsTxt).toBe(fromBase);
  });

  it('declares Google as a DIRECT seller with the standard TAG id', () => {
    const adsTxt = readFileSync(join(ROOT, 'public/ads.txt'), 'utf-8');
    const line = adsTxt.split('\n').find((l) => l.trim() && !l.startsWith('#'));
    expect(line?.trim()).toMatch(/^google\.com,\s*pub-\d+,\s*DIRECT,\s*f08c47fec0942fa0$/);
  });
});
