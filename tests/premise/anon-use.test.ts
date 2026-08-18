/**
 * When a question run spends one of a visitor's three session runs.
 *
 * The rule lives in rate-limit.ts rather than in the route because the route
 * is the one place with no test coverage, and both halves of the rule were
 * learned from real failures: counting attempts made three typos cost a whole
 * session, and counting both staged requests would have silently halved the
 * three runs the page promises.
 */
import { describe, it, expect } from 'vitest';
import { shouldCommitAnonUse } from '../../functions/_lib/rate-limit';

describe('shouldCommitAnonUse', () => {
  it('spends a run on a successful full briefing', () => {
    expect(shouldCommitAnonUse('full', 200)).toBe(true);
  });

  it('spends nothing on the cheap outline half', () => {
    // One question costs one run. The outline is a tenth of a cent and the
    // full run is eight cents; charging for both would make three runs one and
    // a half.
    expect(shouldCommitAnonUse('outline', 200)).toBe(false);
  });

  it('spends nothing when the run failed', () => {
    // A use is a run, not an attempt.
    expect(shouldCommitAnonUse('full', 400)).toBe(false);
    expect(shouldCommitAnonUse('full', 422)).toBe(false);
    expect(shouldCommitAnonUse('full', 502)).toBe(false);
  });

  it('spends nothing when the depth is missing or malformed', () => {
    // The depth is peeked out of an untrusted body, so anything that is not
    // literally 'full' must not be able to charge a visitor.
    expect(shouldCommitAnonUse(undefined, 200)).toBe(false);
    expect(shouldCommitAnonUse(null, 200)).toBe(false);
    expect(shouldCommitAnonUse({ depth: 'full' }, 200)).toBe(false);
    expect(shouldCommitAnonUse('FULL', 200)).toBe(false);
  });
});
