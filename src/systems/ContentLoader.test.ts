import { describe, expect, it } from 'vitest';

import {
  clearContentCache,
  getAirplaneById,
  getAirplanes,
  getOpponentById,
  getOpponents,
  getParts,
  getPartsBySlot,
  getWeatherPresetByCondition,
  getWeatherPresets,
  parseAirplanesDataset,
  parseOpponentsDataset,
  parsePartsDataset,
  parseWeatherPresetsDataset,
} from '@/systems/ContentLoader';

describe('ContentLoader', () => {
  it('loads built-in content datasets through typed query helpers', () => {
    clearContentCache();

    expect(getAirplanes()).toHaveLength(3);
    expect(getParts()).toHaveLength(10);
    expect(getWeatherPresets()).toHaveLength(3);
    expect(getOpponents()).toHaveLength(1);

    expect(getAirplaneById('classic_dart')).toMatchObject({
      type: 'speed',
      unlockCondition: '初始解锁',
    });
    expect(getPartsBySlot('wing')).toHaveLength(2);
    expect(getWeatherPresetByCondition('headwind')).toMatchObject({
      id: 'strong_headwind',
      condition: 'headwind',
    });
    expect(getOpponentById('rookie_lin')).toMatchObject({
      personality: 'aggressive',
      airplaneId: 'classic_dart',
    });
  });

  it('reuses cached content until the cache is cleared', () => {
    clearContentCache();

    const firstAirplanes = getAirplanes();
    const secondAirplanes = getAirplanes();

    expect(secondAirplanes).toBe(firstAirplanes);

    clearContentCache();

    expect(getAirplanes()).not.toBe(firstAirplanes);
  });

  it('rejects invalid airplane, part, weather, and opponent schemas', () => {
    expect(() => parseAirplanesDataset({ airplanes: [{ id: 'broken' }] })).toThrowError(/airplanes\[0\]\.name/i);
    expect(() => parsePartsDataset({ parts: [{ id: 'broken' }] })).toThrowError(/parts\[0\]\.name/i);
    expect(() => parseWeatherPresetsDataset({ weatherPresets: [{ id: 'broken' }] })).toThrowError(
      /weatherPresets\[0\]\.condition/i,
    );
    expect(() => parseOpponentsDataset({ opponents: [{ id: 'broken' }] })).toThrowError(
      /opponents\[0\]\.name/i,
    );
  });
});
