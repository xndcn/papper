import { describe, expect, it } from 'vitest';

import type { AirplaneStats, Weather } from '@/types';
import { calculateWindEffect, getWindVector, selectWeather } from '@/systems/WeatherSystem';

const DEFAULT_STATS: AirplaneStats = {
  speed: 5,
  glide: 5,
  stability: 5,
  trick: 5,
  durability: 5,
};

function createWeather(overrides: Partial<Weather>): Weather {
  return {
    id: 'weather',
    condition: 'calm',
    windDirection: { x: 0, y: 0 },
    windStrength: 0,
    effects: {
      speedModifier: 1,
      glideModifier: 1,
      stabilityModifier: 1,
      visibilityRange: 1000,
      turbulenceIntensity: 0,
    },
    displayName: '测试天气',
    description: '用于单元测试',
    weight: 1,
    ...overrides,
  };
}

describe('WeatherSystem', () => {
  it('normalizes wind direction into a scaled wind vector', () => {
    const windVector = getWindVector(
      createWeather({
        windDirection: { x: 3, y: 4 },
        windStrength: 5,
      }),
    );

    expect(windVector.x).toBeCloseTo(0.003);
    expect(windVector.y).toBeCloseTo(0.004);
  });

  it('calculates no wind, tailwind, and headwind effects', () => {
    expect(calculateWindEffect(createWeather({ condition: 'calm' }), DEFAULT_STATS)).toEqual({ x: 0, y: 0 });

    expect(
      calculateWindEffect(
        createWeather({
          condition: 'tailwind',
          windDirection: { x: 1, y: 0 },
          windStrength: 3,
        }),
        DEFAULT_STATS,
      ).x,
    ).toBeGreaterThan(0);

    expect(
      calculateWindEffect(
        createWeather({
          condition: 'headwind',
          windDirection: { x: -1, y: 0 },
          windStrength: 7,
        }),
        DEFAULT_STATS,
      ).x,
    ).toBeLessThan(0);
  });

  it('reduces wind effect for more stable airplanes', () => {
    const weather = createWeather({
      condition: 'crosswind',
      windDirection: { x: 0, y: -1 },
      windStrength: 6,
    });
    const unstableEffect = calculateWindEffect(weather, { ...DEFAULT_STATS, stability: 1 });
    const stableEffect = calculateWindEffect(weather, { ...DEFAULT_STATS, stability: 10 });

    expect(Math.abs(stableEffect.y)).toBeLessThan(Math.abs(unstableEffect.y));
  });

  it('selects weather deterministically from weighted presets when a seed is provided', () => {
    const presets = [
      createWeather({ id: 'calm', displayName: '风和日丽', weight: 40 }),
      createWeather({
        id: 'tailwind',
        condition: 'tailwind',
        windDirection: { x: 1, y: 0 },
        windStrength: 3,
        displayName: '微风顺吹',
        weight: 35,
      }),
      createWeather({
        id: 'headwind',
        condition: 'headwind',
        windDirection: { x: -1, y: 0 },
        windStrength: 7,
        displayName: '强劲逆风',
        weight: 25,
      }),
    ] as const;

    expect(selectWeather(presets, 1).id).toBe('calm');
    expect(selectWeather(presets, 12345).id).toBe('tailwind');
    expect(selectWeather(presets, 99999).id).toBe('headwind');
  });
});
