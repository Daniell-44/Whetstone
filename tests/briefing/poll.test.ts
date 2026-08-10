import { describe, it, expect } from 'vitest';
import { sortBarsByPole, poleFor, type PollBar } from '../../functions/_lib/briefing/poll';

const AXIS = { left: 'nuclear pathway cheaper', right: 'renewables pathway cheaper' };

describe('sortBarsByPole', () => {
  it('puts the left pole first and the right pole last however they were authored', () => {
    const authored: PollBar[] = [
      { label: 'renewables plan', value: 43, side: 'right' },
      { label: 'nuclear plan', value: 33, side: 'left' },
    ];
    expect(sortBarsByPole(authored).map((b) => b.label)).toEqual(['nuclear plan', 'renewables plan']);
  });

  it('leaves an already-correct order alone', () => {
    const authored: PollBar[] = [
      { label: 'nuclear plan', value: 33, side: 'left' },
      { label: 'renewables plan', value: 43, side: 'right' },
    ];
    expect(sortBarsByPole(authored).map((b) => b.label)).toEqual(['nuclear plan', 'renewables plan']);
  });

  it('keeps an unsided poll in exactly its authored order', () => {
    // The author's ordering is editorial here, so the sort must not touch it.
    const authored: PollBar[] = [
      { label: 'renewables', value: 35 },
      { label: 'fossil fuels', value: 27 },
      { label: 'nuclear', value: 38 },
    ];
    expect(sortBarsByPole(authored).map((b) => b.label)).toEqual(['renewables', 'fossil fuels', 'nuclear']);
  });

  it('seats unsided answers between the two poles', () => {
    const authored: PollBar[] = [
      { label: 'agreed', value: 56, side: 'right' },
      { label: 'disagreed', value: 13 },
      { label: 'strongly against', value: 8, side: 'left' },
    ];
    expect(sortBarsByPole(authored).map((b) => b.label)).toEqual(['strongly against', 'disagreed', 'agreed']);
  });

  it('is stable within a pole', () => {
    const authored: PollBar[] = [
      { label: 'first right', value: 10, side: 'right' },
      { label: 'second right', value: 20, side: 'right' },
      { label: 'only left', value: 30, side: 'left' },
    ];
    expect(sortBarsByPole(authored).map((b) => b.label)).toEqual(['only left', 'first right', 'second right']);
  });

  it('does not mutate the input', () => {
    const authored: PollBar[] = [
      { label: 'renewables plan', value: 43, side: 'right' },
      { label: 'nuclear plan', value: 33, side: 'left' },
    ];
    sortBarsByPole(authored);
    expect(authored.map((b) => b.label)).toEqual(['renewables plan', 'nuclear plan']);
  });
});

describe('poleFor', () => {
  it('names each pole in the axis words', () => {
    expect(poleFor('left', AXIS)).toBe('nuclear pathway cheaper');
    expect(poleFor('right', AXIS)).toBe('renewables pathway cheaper');
  });

  it('returns nothing for an answer that reads for neither pole', () => {
    // An empty string is what suppresses the "(favours …)" tail on the values
    // line, so a neutral answer must never be given a pole it does not have.
    expect(poleFor(undefined, AXIS)).toBe('');
  });
});
