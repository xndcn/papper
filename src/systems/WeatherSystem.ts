import { MAX_STAT_VALUE, MIN_STAT_VALUE } from '@/config/constants';
import type { AirplaneStats, Weather } from '@/types';
import { clamp, normalizeVector, scaleVector, vectorMagnitude, type Vector2Like } from '@/utils/math';

const WIND_FORCE_SCALE = 0.001;
const MIN_WIND_RESISTANCE = 0.1;
const MAX_WIND_RESISTANCE = 0.7;

export function getWindVector(weather: Weather): Vector2Like {
  if (weather.windStrength <= 0 || vectorMagnitude(weather.windDirection) === 0) {
    return { x: 0, y: 0 };
  }

  return scaleVector(normalizeVector(weather.windDirection), weather.windStrength * WIND_FORCE_SCALE);
}

export function calculateWindEffect(weather: Weather, airplaneStats: AirplaneStats): Vector2Like {
  const windVector = getWindVector(weather);

  if (windVector.x === 0 && windVector.y === 0) {
    return windVector;
  }

  const stability = clamp(airplaneStats.stability, MIN_STAT_VALUE, MAX_STAT_VALUE);
  const resistanceProgress = (stability - MIN_STAT_VALUE) / (MAX_STAT_VALUE - MIN_STAT_VALUE);
  const windResistance =
    MIN_WIND_RESISTANCE + (MAX_WIND_RESISTANCE - MIN_WIND_RESISTANCE) * resistanceProgress;

  return scaleVector(windVector, 1 - windResistance);
}

export function selectWeather(presets: readonly Weather[], seed?: number): Weather {
  if (presets.length === 0) {
    throw new Error('at least one weather preset is required');
  }

  const totalWeight = presets.reduce((sum, preset) => sum + Math.max(0, preset.weight), 0);

  if (totalWeight <= 0) {
    return presets[0];
  }

  const roll = seed === undefined ? Math.random() * totalWeight : ((seed % totalWeight) + totalWeight) % totalWeight;
  let cumulativeWeight = 0;

  for (const preset of presets) {
    cumulativeWeight += Math.max(0, preset.weight);

    if (roll < cumulativeWeight) {
      return preset;
    }
  }

  return presets[presets.length - 1];
}
