import { describe, expect, it } from 'vitest';

import { createRNG, randomInt, shuffle, weightedChoice } from '@/utils/SeedManager';

describe('SeedManager', () => {
  it('creates deterministic random sequences from the same seed', () => {
    const first = createRNG(12345);
    const second = createRNG(12345);

    const firstSequence = [first(), first(), first(), first()];
    const secondSequence = [second(), second(), second(), second()];

    expect(secondSequence).toEqual(firstSequence);
    expect(firstSequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('generates inclusive random integers within the given range', () => {
    expect(randomInt(() => 0, 2, 4)).toBe(2);
    expect(randomInt(() => 0.999999, 2, 4)).toBe(4);
  });

  it('selects weighted items deterministically', () => {
    expect(weightedChoice(() => 0.1, ['race', 'shop', 'elite'], [4, 2, 1])).toBe('race');
    expect(weightedChoice(() => 0.7, ['race', 'shop', 'elite'], [4, 2, 1])).toBe('shop');
    expect(weightedChoice(() => 0.99, ['race', 'shop', 'elite'], [4, 2, 1])).toBe('elite');
  });

  it('shuffles arrays deterministically without mutating the input', () => {
    const source = ['a', 'b', 'c', 'd'];

    const firstShuffle = shuffle(createRNG(9), source);
    const secondShuffle = shuffle(createRNG(9), source);

    expect(firstShuffle).toEqual(secondShuffle);
    expect(firstShuffle).not.toEqual(source);
    expect([...firstShuffle].sort()).toEqual(source);
    expect(source).toEqual(['a', 'b', 'c', 'd']);
  });
});
