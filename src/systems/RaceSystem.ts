import type { Vector2Like } from '@/utils/math';

export interface FlightScoreInput {
  readonly distancePx: number;
  readonly flightTimeMs: number;
}

export interface FlightScoreResult {
  readonly distancePx: number;
  readonly flightTimeMs: number;
  readonly distanceScore: number;
  readonly airtimeScore: number;
  readonly totalScore: number;
}

export interface FlightBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

const DEFAULT_AIRTIME_SCORE_PER_SECOND = 100;

export function calculateFlightScore({ distancePx, flightTimeMs }: FlightScoreInput): FlightScoreResult {
  const normalizedDistancePx = Math.max(0, Math.round(distancePx));
  const normalizedFlightTimeMs = Math.max(0, Math.round(flightTimeMs));
  const distanceScore = normalizedDistancePx;
  const airtimeScore = Math.round((normalizedFlightTimeMs / 1000) * DEFAULT_AIRTIME_SCORE_PER_SECOND);

  return {
    distancePx: normalizedDistancePx,
    flightTimeMs: normalizedFlightTimeMs,
    distanceScore,
    airtimeScore,
    totalScore: distanceScore + airtimeScore,
  };
}

export function isFlightOutOfBounds(position: Vector2Like, bounds: FlightBounds): boolean {
  return position.x < bounds.minX || position.x > bounds.maxX || position.y < bounds.minY || position.y > bounds.maxY;
}
