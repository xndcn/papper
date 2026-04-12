function normalizeSeed(seed: number): number {
  const normalizedSeed = Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : 0;
  return normalizedSeed === 0 ? 1 : normalizedSeed;
}

export function createRNG(seed: number): () => number {
  let state = normalizeSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;

    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: () => number, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error('randomInt requires an integer range with max >= min');
  }

  return Math.floor(rng() * (max - min + 1)) + min;
}

export function weightedChoice<T>(rng: () => number, items: readonly T[], weights: readonly number[]): T {
  if (items.length === 0 || items.length !== weights.length) {
    throw new Error('weightedChoice requires non-empty items and matching weights');
  }

  const totalWeight = weights.reduce((total, weight) => total + Math.max(0, weight), 0);

  if (totalWeight <= 0) {
    return items[0]!;
  }

  const targetWeight = rng() * totalWeight;
  let cumulativeWeight = 0;

  for (const [index, item] of items.entries()) {
    cumulativeWeight += Math.max(0, weights[index] ?? 0);

    if (targetWeight < cumulativeWeight) {
      return item;
    }
  }

  return items[items.length - 1]!;
}

export function shuffle<T>(rng: () => number, array: readonly T[]): T[] {
  const result = [...array];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, 0, index);
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }

  return result;
}
