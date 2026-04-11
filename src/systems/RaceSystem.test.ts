import { describe, expect, it } from 'vitest';

import { calculateFlightScore, isFlightOutOfBounds } from '@/systems/RaceSystem';

describe('RaceSystem', () => {
  it('scores distance and air time into a total result', () => {
    expect(calculateFlightScore({ distancePx: 420, flightTimeMs: 2650 })).toEqual({
      distancePx: 420,
      flightTimeMs: 2650,
      distanceScore: 420,
      airtimeScore: 265,
      totalScore: 685,
    });
  });

  it('detects when the airplane leaves the playable flight bounds', () => {
    const bounds = { minX: 0, maxX: 100, minY: -20, maxY: 80 };

    expect(isFlightOutOfBounds({ x: 50, y: 40 }, bounds)).toBe(false);
    expect(isFlightOutOfBounds({ x: 101, y: 40 }, bounds)).toBe(true);
    expect(isFlightOutOfBounds({ x: 50, y: -25 }, bounds)).toBe(true);
  });
});
