import { describe, expect, it } from 'vitest';

import {
  addVectors,
  clamp,
  dotProduct,
  lerp,
  normalizeVector,
  perpendicularVector,
  scaleVector,
  subtractVectors,
  vectorMagnitude,
  wrapAngleDegrees,
} from '@/utils/math';

describe('math utilities', () => {
  it('clamps and interpolates scalar values', () => {
    expect(clamp(-2, 0, 10)).toBe(0);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(6, 0, 10)).toBe(6);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(lerp(10, 20, 2)).toBe(20);
  });

  it('supports core vector operations', () => {
    expect(addVectors({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    expect(subtractVectors({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
    expect(scaleVector({ x: 3, y: -2 }, 2)).toEqual({ x: 6, y: -4 });
    expect(vectorMagnitude({ x: 3, y: 4 })).toBe(5);
    expect(dotProduct({ x: 2, y: 1 }, { x: -1, y: 4 })).toBe(2);
    expect(perpendicularVector({ x: 5, y: -2 })).toEqual({ x: 2, y: 5 });
  });

  it('normalizes vectors and wraps angles safely', () => {
    expect(normalizeVector({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    const normalizedVector = normalizeVector({ x: 3, y: 4 });
    expect(normalizedVector.x).toBeCloseTo(0.6);
    expect(normalizedVector.y).toBeCloseTo(0.8);
    expect(wrapAngleDegrees(190)).toBe(-170);
    expect(wrapAngleDegrees(-190)).toBe(170);
  });
});
