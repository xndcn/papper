import { GAME_GRAVITY } from '@/config/constants';
import { calculateDragCoefficient, calculateStatBasedLaunchForce } from '@/systems/PhysicsSystem';
import { calculateFlightScore, type FlightScoreResult } from '@/systems/RaceSystem';
import { calculateWindEffect } from '@/systems/WeatherSystem';
import type { AirplaneStats, Opponent, Weather } from '@/types';
import { clamp, vectorMagnitude } from '@/utils/math';

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
  const angleDegrees = clamp(
    personalityProfile.angleDegrees + weatherAdjustment.angleDegrees + difficultyFactor * 4,
    MIN_AI_ANGLE_DEGREES,
    MAX_AI_ANGLE_DEGREES,
  );
  const power = clamp(
    personalityProfile.power + weatherAdjustment.power + difficultyFactor * 0.04,
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
): SimulatedOpponentFlightResult {
  const launchForceMagnitude = vectorMagnitude(
    calculateStatBasedLaunchForce(airplaneStats.speed, launchParams.power, launchParams.angleRadians),
  );
  const launchSpeed = launchForceMagnitude * LAUNCH_FORCE_TO_SPEED_SCALE;
  const dragCoefficient = calculateDragCoefficient(airplaneStats.glide);
  const windEffect = calculateWindEffect(weather, airplaneStats);
  const horizontalRetention = clamp(1.08 - dragCoefficient * 8, 0.55, 1.05);
  const horizontalVelocity = Math.cos(launchParams.angleRadians) * launchSpeed * horizontalRetention;
  const verticalVelocity = Math.sin(launchParams.angleRadians) * launchSpeed * (0.48 + airplaneStats.glide * 0.035);
  const baseAirtimeSeconds = (2 * verticalVelocity) / SIMULATION_GRAVITY;
  const stabilityBonusSeconds = airplaneStats.stability * 0.08;
  const airtimeSeconds = clamp(
    baseAirtimeSeconds + stabilityBonusSeconds,
    MIN_AIRTIME_SECONDS,
    Math.max(MIN_AIRTIME_SECONDS, raceDuration),
  );
  const windDistance = windEffect.x * WIND_DISTANCE_SCALE * airtimeSeconds;
  const turbulencePenalty = Math.max(0, weather.windStrength - airplaneStats.stability) * weather.effects.turbulenceIntensity * 20;
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
