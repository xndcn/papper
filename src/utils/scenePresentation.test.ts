import { describe, expect, it } from 'vitest';

import { formatRelativeRacePosition, getWindDirectionArrow, PRELOAD_JSON_ASSETS } from '@/utils/scenePresentation';

describe('scenePresentation utilities', () => {
  it('describes the phase 1 step 6 json preload manifest', () => {
    expect(PRELOAD_JSON_ASSETS).toEqual([
      { key: 'airplanes-data', label: '飞机图鉴', relativePath: '../data/airplanes.json' },
      { key: 'parts-data', label: '零件库', relativePath: '../data/parts.json' },
      { key: 'weather-data', label: '天气预设', relativePath: '../data/weather-presets.json' },
      { key: 'opponents-data', label: '对手档案', relativePath: '../data/opponents.json' },
    ]);
  });

  it('formats relative race positions for lead, trail, and tie states', () => {
    expect(formatRelativeRacePosition(180, 120)).toBe('相对位置：领先 60px');
    expect(formatRelativeRacePosition(120, 180)).toBe('相对位置：落后 60px');
    expect(formatRelativeRacePosition(128, 132)).toBe('相对位置：并驾齐驱');
  });

  it('maps wind vectors to readable direction arrows', () => {
    expect(getWindDirectionArrow({ windDirection: { x: 0, y: 0 }, windStrength: 0 })).toBe('·');
    expect(getWindDirectionArrow({ windDirection: { x: 1, y: 0 }, windStrength: 1 })).toBe('→');
    expect(getWindDirectionArrow({ windDirection: { x: 0, y: -1 }, windStrength: 1 })).toBe('↑');
  });
});
