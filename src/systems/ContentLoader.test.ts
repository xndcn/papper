import { describe, expect, it } from 'vitest';

import {
  clearContentCache,
  getAirplaneById,
  getAirplanes,
  getBuffById,
  getBuffs,
  getOpponentById,
  getOpponents,
  getParts,
  getPartsBySlot,
  getSkillById,
  getSkills,
  getSkillsByType,
  getWeatherPresetByCondition,
  getWeatherPresets,
  parseAirplanesDataset,
  parseBuffsDataset,
  parseOpponentsDataset,
  parsePartsDataset,
  parseSkillsDataset,
  parseWeatherPresetsDataset,
} from '@/systems/ContentLoader';

describe('ContentLoader', () => {
  it('loads built-in content datasets through typed query helpers', () => {
    clearContentCache();

    expect(getAirplanes()).toHaveLength(3);
    expect(getParts()).toHaveLength(10);
    expect(getWeatherPresets()).toHaveLength(3);
    expect(getOpponents()).toHaveLength(4);
    expect(getSkills()).toHaveLength(5);
    expect(getBuffs()).toHaveLength(6);

    expect(getAirplaneById('classic_dart')).toMatchObject({
      type: 'speed',
      unlockCondition: '初始解锁',
    });
    expect(getSkillById('boost_dash')).toMatchObject({
      type: 'active',
      cooldown: 12000,
    });
    expect(getSkillsByType('passive')).toHaveLength(2);
    expect(getBuffById('origami_spirit')).toMatchObject({
      rarity: 'legendary',
      stackable: false,
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
    expect(getOpponentById('storm_wei')).toMatchObject({
      personality: 'balanced',
      airplaneId: 'classic_glider',
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

  it('rejects invalid skill and buff schemas', () => {
    expect(() =>
      parseSkillsDataset({
        skills: [
          {
            id: 'broken',
            type: 'active',
            description: '缺少名称',
            cooldown: 1000,
            effect: {
              type: 'special',
              target: 'self',
              value: 1,
            },
            iconKey: 'skill_broken',
            rarity: 'common',
          },
        ],
      }),
    ).toThrowError(/skills\[0\]\.name/i);
    expect(() =>
      parseSkillsDataset({
        skills: [
          {
            id: 'broken_passive',
            name: '坏技能',
            type: 'passive',
            description: '缺少 trigger',
            effect: {
              type: 'stat_boost',
              target: 'self',
              value: { speed: 1 },
            },
            iconKey: 'skill_broken',
            rarity: 'common',
          },
        ],
      }),
    ).toThrowError(/trigger/i);
    expect(() => parseBuffsDataset({ buffs: [{ id: 'broken' }] })).toThrowError(/buffs\[0\]\.name/i);
  });
});
