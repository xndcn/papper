import type { Weather } from '@/types';
import { vectorMagnitude } from '@/utils/math';

export interface PreloadJsonAsset {
  readonly key: string;
  readonly label: string;
  readonly relativePath: string;
}

export const PRELOAD_JSON_ASSETS: readonly PreloadJsonAsset[] = [
  { key: 'airplanes-data', label: '飞机图鉴', relativePath: '../data/airplanes.json' },
  { key: 'parts-data', label: '零件库', relativePath: '../data/parts.json' },
  { key: 'weather-data', label: '天气预设', relativePath: '../data/weather-presets.json' },
  { key: 'opponents-data', label: '对手档案', relativePath: '../data/opponents.json' },
];

export function formatRelativeRacePosition(playerDistancePx: number, opponentDistancePx: number): string {
  const distanceDelta = Math.round(playerDistancePx - opponentDistancePx);

  if (Math.abs(distanceDelta) < 8) {
    return '相对位置：并驾齐驱';
  }

  return distanceDelta > 0 ? `相对位置：领先 ${distanceDelta}px` : `相对位置：落后 ${Math.abs(distanceDelta)}px`;
}

export function getWindDirectionArrow({ windDirection, windStrength }: Pick<Weather, 'windDirection' | 'windStrength'>): string {
  if (windStrength <= 0 || vectorMagnitude(windDirection) === 0) {
    return '·';
  }

  const arrowBySector = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'] as const;
  const angle = Math.atan2(windDirection.y, windDirection.x);
  // Shift negative turns into the [0, 1) range before mapping the normalized angle to 8 arrow sectors.
  const normalizedTurns = ((angle / (Math.PI * 2)) + 1) % 1;
  const sectorIndex = Math.round(normalizedTurns * arrowBySector.length) % arrowBySector.length;

  return arrowBySector[sectorIndex];
}
