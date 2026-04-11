import { describe, expect, it } from 'vitest';

import { calculateAILaunchParams, generateOpponentScore, simulateOpponentFlight } from '@/systems/OpponentAI';
import type { AirplaneStats, Opponent, Weather } from '@/types';

function createOpponent(personality: Opponent['personality'], difficulty = 2): Opponent {
  return {
    id: `opponent-${personality}`,
    name: '测试对手',
    title: '试飞员',
    personality,
    airplaneId: 'test-airplane',
    partIds: [],
    dialogues: {
      greeting: '你好',
      onWin: '赢了',
      onLose: '输了',
      taunt: '来吧',
      respect: '不错',
    },
    difficulty,
    spriteKey: 'opponent',
    backstory: '用于测试',
  };
}

function createWeather(condition: Weather['condition']): Weather {
  return {
    id: `weather-${condition}`,
    condition,
    windDirection: { x: 1, y: 0 },
    windStrength: condition === 'storm' ? 7 : condition === 'calm' ? 0 : 4,
    effects: {
      speedModifier: 0,
      glideModifier: 0,
      stabilityModifier: 0,
      visibilityRange: 1,
      turbulenceIntensity: condition === 'storm' ? 0.9 : 0.2,
    },
    displayName: condition,
    description: '用于测试',
    weight: 1,
  };
}

const LOW_STATS: AirplaneStats = {
  speed: 3,
  glide: 3,
  stability: 3,
  trick: 3,
  durability: 3,
};

const HIGH_STATS: AirplaneStats = {
  speed: 8,
  glide: 8,
  stability: 8,
  trick: 3,
  durability: 3,
};

describe('OpponentAI', () => {
  it('generates launch parameters that reflect opponent personality and weather', () => {
    const aggressive = calculateAILaunchParams(createOpponent('aggressive'), createWeather('tailwind'));
    const cautious = calculateAILaunchParams(createOpponent('cautious'), createWeather('headwind'));

    expect(aggressive.power).toBeGreaterThan(cautious.power);
    expect(aggressive.angleDegrees).toBeLessThan(cautious.angleDegrees);
    expect(aggressive.angleDegrees).toBeGreaterThanOrEqual(10);
    expect(cautious.angleDegrees).toBeLessThanOrEqual(60);
  });

  it('simulates longer and farther flights for stronger airplane stats', () => {
    const launchParams = {
      angleDegrees: 30,
      angleRadians: Math.PI / 6,
      power: 0.75,
    };
    const weather = createWeather('calm');

    const weakerFlight = simulateOpponentFlight(launchParams, LOW_STATS, weather, 8);
    const strongerFlight = simulateOpponentFlight(launchParams, HIGH_STATS, weather, 8);

    expect(strongerFlight.distancePx).toBeGreaterThan(weakerFlight.distancePx);
    expect(strongerFlight.flightTimeMs).toBeGreaterThan(weakerFlight.flightTimeMs);
  });

  it('reuses race scoring rules for the opponent final score', () => {
    expect(generateOpponentScore({ distancePx: 320, flightTimeMs: 1800 })).toEqual({
      distancePx: 320,
      flightTimeMs: 1800,
      distanceScore: 320,
      airtimeScore: 180,
      totalScore: 500,
    });
  });
});
