import { GAME_GRAVITY } from '@/config/constants';
import { calculateDragCoefficient, calculateStatBasedLaunchForce } from '@/systems/PhysicsSystem';
import { calculateFlightScore, type FlightScoreResult } from '@/systems/RaceSystem';
import { calculateWindEffect } from '@/systems/WeatherSystem';
import type { AirplaneStats, Opponent, Weather } from '@/types';
import { clamp, lerp, vectorMagnitude } from '@/utils/math';

export interface AILaunchParams {
  readonly angleDegrees: number;
  readonly angleRadians: number;
  readonly power: number;
}

export interface SimulatedOpponentFlightResult {
  readonly distancePx: number;
  readonly flightTimeMs: number;
}

const AI_PERSONALITY_PROFILES = {
  aggressive: { angleDegrees: 22, power: 0.92 },
  balanced: { angleDegrees: 31, power: 0.78 },
  cautious: { angleDegrees: 38, power: 0.68 },
  tricky: { angleDegrees: 29, power: 0.74 },
} as const;

const WEATHER_ADJUSTMENTS = {
  tailwind: { angleDegrees: -4, power: 0.04 },
  headwind: { angleDegrees: 5, power: -0.03 },
  crosswind: { angleDegrees: 2, power: -0.02 },
  storm: { angleDegrees: 7, power: -0.12 },
  calm: { angleDegrees: 0, power: 0 },
} as const;

const MIN_AI_ANGLE_DEGREES = 16;
const MAX_AI_ANGLE_DEGREES = 52;
const MIN_AI_POWER = 0.45;
const MAX_AI_POWER = 1;
const LAUNCH_FORCE_TO_SPEED_SCALE = 22000;
const SIMULATION_GRAVITY = GAME_GRAVITY.y * 120;
const DISTANCE_SCALE = 6;
const WIND_DISTANCE_SCALE = 30000;
const MIN_AIRTIME_SECONDS = 0.7;
const BOSS_LAUNCH_ANGLE_TARGET = 30;
const BOSS_LAUNCH_POWER_TARGET = 0.98;
const BOSS_WEATHER_VARIANCE_SCALE = 0.45;
const BOSS_SKILL_BONUS = {
  speed: 1,
  glide: 1,
  stability: 1,
} as const;

/**
 * Normalizes the content difficulty field (authored on a 1-10 scale) into a 0-1 factor
 * that slightly nudges the AI toward sharper launch angles and stronger power values.
 */
function resolveDifficultyFactor(difficulty: number): number {
  return clamp((difficulty - 1) / 9, 0, 1);
}

export function calculateAILaunchParams(opponent: Opponent, weather: Weather): AILaunchParams {
  const personalityProfile = AI_PERSONALITY_PROFILES[opponent.personality];
  const weatherAdjustment = WEATHER_ADJUSTMENTS[weather.condition];
  const difficultyFactor = resolveDifficultyFactor(opponent.difficulty);
  const isBoss = isBossOpponent(opponent);
  const weatherScale = isBoss ? BOSS_WEATHER_VARIANCE_SCALE : 1;
  const angleDegrees = clamp(
    (isBoss
      ? lerp(
          personalityProfile.angleDegrees + weatherAdjustment.angleDegrees * weatherScale + difficultyFactor * 4,
          BOSS_LAUNCH_ANGLE_TARGET,
          0.55,
        )
      : personalityProfile.angleDegrees + weatherAdjustment.angleDegrees * weatherScale + difficultyFactor * 4),
    MIN_AI_ANGLE_DEGREES,
    MAX_AI_ANGLE_DEGREES,
  );
  const power = clamp(
    (isBoss
      ? lerp(
          personalityProfile.power + weatherAdjustment.power * weatherScale + difficultyFactor * 0.04,
          BOSS_LAUNCH_POWER_TARGET,
          0.45,
        )
      : personalityProfile.power + weatherAdjustment.power * weatherScale + difficultyFactor * 0.04),
    MIN_AI_POWER,
    MAX_AI_POWER,
  );

  return {
    angleDegrees,
    angleRadians: (angleDegrees * Math.PI) / 180,
    power,
  };
}

export function simulateOpponentFlight(
  launchParams: AILaunchParams,
  airplaneStats: AirplaneStats,
  weather: Weather,
  raceDuration: number,
  opponent?: Opponent,
): SimulatedOpponentFlightResult {
  const effectiveStats = applyOpponentFlightBonuses(airplaneStats, opponent);
  const launchForceMagnitude = vectorMagnitude(
    calculateStatBasedLaunchForce(effectiveStats.speed, launchParams.power, launchParams.angleRadians),
  );
  const launchSpeed = launchForceMagnitude * LAUNCH_FORCE_TO_SPEED_SCALE;
  const dragCoefficient = calculateDragCoefficient(effectiveStats.glide);
  const windEffect = calculateWindEffect(weather, effectiveStats);
  const horizontalRetention = clamp(1.08 - dragCoefficient * 8, 0.55, 1.05);
  const horizontalVelocity = Math.cos(launchParams.angleRadians) * launchSpeed * horizontalRetention;
  const verticalVelocity = Math.sin(launchParams.angleRadians) * launchSpeed * (0.48 + effectiveStats.glide * 0.035);
  const baseAirtimeSeconds = (2 * verticalVelocity) / SIMULATION_GRAVITY;
  const stabilityBonusSeconds = effectiveStats.stability * 0.08;
  const airtimeSeconds = clamp(
    baseAirtimeSeconds + stabilityBonusSeconds,
    MIN_AIRTIME_SECONDS,
    Math.max(MIN_AIRTIME_SECONDS, raceDuration),
  );
  const windDistance = windEffect.x * WIND_DISTANCE_SCALE * airtimeSeconds;
  const turbulencePenalty =
    Math.max(0, weather.windStrength - effectiveStats.stability) * weather.effects.turbulenceIntensity * 20;
  const distancePx = Math.max(
    0,
    Math.round(horizontalVelocity * airtimeSeconds * DISTANCE_SCALE + windDistance - turbulencePenalty),
  );

  return {
    distancePx,
    flightTimeMs: Math.round(airtimeSeconds * 1000),
  };
}

export function generateOpponentScore(flightResult: SimulatedOpponentFlightResult): FlightScoreResult {
  return calculateFlightScore(flightResult);
}

function applyOpponentFlightBonuses(airplaneStats: AirplaneStats, opponent: Opponent | undefined): AirplaneStats {
  if (!opponent || !isBossOpponent(opponent)) {
    return airplaneStats;
  }

  return {
    ...airplaneStats,
    speed: clamp(airplaneStats.speed + BOSS_SKILL_BONUS.speed, 1, 10),
    glide: clamp(airplaneStats.glide + BOSS_SKILL_BONUS.glide, 1, 10),
    stability: clamp(airplaneStats.stability + BOSS_SKILL_BONUS.stability, 1, 10),
  };
}

function isBossOpponent(opponent: Opponent): boolean {
  return opponent.title.includes('馆主');
}
