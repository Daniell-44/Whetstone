import { describe, it, expect } from 'vitest';
import { matchFindings, prf, calibration } from '../../evals/detection/metrics';

describe('matchFindings', () => {
  it('matches by name, case-insensitively', () => {
    const m = matchFindings(['Ad Hominem', 'Straw Man'], ['straw man', 'AD HOMINEM']);
    expect(m).toMatchObject({ tp: 2, fp: 0, fn: 0 });
  });

  it('counts over-detection as false positives', () => {
    const m = matchFindings(['Ad Hominem'], ['Ad Hominem', 'Slippery Slope']);
    expect(m.tp).toBe(1);
    expect(m.fp).toBe(1);
    expect(m.spurious).toEqual(['Slippery Slope']);
  });

  it('counts misses as false negatives', () => {
    const m = matchFindings(['Ad Hominem', 'Equivocation'], ['Ad Hominem']);
    expect(m.tp).toBe(1);
    expect(m.fn).toBe(1);
    expect(m.missed).toEqual(['equivocation']);
  });

  it('handles an adversarial zero-finding fixture the engine leaves alone', () => {
    expect(matchFindings([], [])).toMatchObject({ tp: 0, fp: 0, fn: 0 });
  });

  it('flags a false finding on a clean passage', () => {
    expect(matchFindings([], ['Slippery Slope'])).toMatchObject({ tp: 0, fp: 1, fn: 0 });
  });
});

describe('prf', () => {
  it('computes precision/recall/f1', () => {
    const { precision, recall, f1 } = prf(3, 1, 1);
    expect(precision).toBeCloseTo(0.75);
    expect(recall).toBeCloseTo(0.75);
    expect(f1).toBeCloseTo(0.75);
  });

  it('scores a left-alone clean passage as perfect (F1=1)', () => {
    expect(prf(0, 0, 0).f1).toBe(1);
  });

  it('scores a false finding on a clean passage as precision 0, F1 0', () => {
    const r = prf(0, 1, 0);
    expect(r.precision).toBe(0);
    expect(r.f1).toBe(0);
  });
});

describe('calibration (ECE)', () => {
  it('is ~0 when confidence matches accuracy', () => {
    // 90%-confidence findings that are correct 90%+ of the time → low ECE
    const samples = [
      ...Array.from({ length: 9 }, () => ({ confidence: 90, correct: true })),
      { confidence: 90, correct: false },
    ];
    expect(calibration(samples).ece).toBeLessThan(0.1);
  });

  it('is high when the engine is overconfident', () => {
    // all claim 90% but only 20% are correct
    const samples = [
      { confidence: 90, correct: true },
      ...Array.from({ length: 4 }, () => ({ confidence: 90, correct: false })),
    ];
    expect(calibration(samples).ece).toBeGreaterThan(0.5);
  });

  it('returns 0 for no samples', () => {
    expect(calibration([]).ece).toBe(0);
  });
});
