import {
  addVectors,
  clamp,
  lerp,
  normalizeVector,
  radiansToDegrees,
  scaleVector,
  subtractVectors,
  vectorMagnitude,
  wrapAngleDegrees,
  type Vector2Like,
} from '@/utils/math';
import { MAX_STAT_VALUE, MIN_STAT_VALUE } from '@/config/constants';

export interface AeroCoefficients {
  readonly lift: number;
  readonly drag: number;
}

export interface LaunchVectorInput {
  readonly anchor: Vector2Like;
  readonly dragPosition: Vector2Like;
  readonly speedStat?: number;
  readonly maxDragDistance?: number;
}

export interface LaunchVectorResult {
  readonly force: Vector2Like;
  readonly dragDistance: number;
  readonly power: number;
  readonly angleRadians: number;
}

export interface TrajectoryPreviewInput {
  readonly origin: Vector2Like;
  readonly launchForce: Vector2Like;
  readonly gravity?: number;
  readonly gravityScale?: number;
  readonly steps?: number;
  readonly timeStep?: number;
  readonly velocityScale?: number;
}

export interface AerodynamicForceInput {
  readonly airplaneAngleRadians: number;
  readonly velocity: Vector2Like;
  readonly liftMultiplier?: number;
  readonly dragMultiplier?: number;
  readonly minSpeed?: number;
}

export type PitchControlDirection = 'up' | 'down' | 'neutral';

export interface PitchControlInput {
  readonly currentAngularVelocity: number;
  readonly direction: PitchControlDirection;
  readonly step?: number;
  readonly maxAngularVelocity?: number;
}

export interface GlideAlignmentInput {
  readonly currentRotationRadians: number;
  readonly velocity: Vector2Like;
  readonly stabilityStat: number;
  readonly deltaMs: number;
  readonly minSpeed?: number;
  readonly minTurnRateRadiansPerSecond?: number;
  readonly maxTurnRateRadiansPerSecond?: number;
}

const DEFAULT_MAX_DRAG_DISTANCE = 72;
const BASE_LAUNCH_FORCE = 0.0015;
const SPEED_FORCE_MULTIPLIER = 0.00045;
const DEFAULT_TRAJECTORY_STEPS = 14;
const DEFAULT_TRAJECTORY_TIME_STEP = 0.08;
const DEFAULT_TRAJECTORY_VELOCITY_SCALE = 22000;
const DEFAULT_TRAJECTORY_GRAVITY_SCALE = 320;
const MIN_AERO_ANGLE = -10;
const MAX_AERO_ANGLE = 45;
// Minimum body speed below which lift/drag are ignored to avoid micro-jitter near rest.
const DEFAULT_MIN_AERODYNAMIC_SPEED = 0.1;
// Prototype aerodynamic tuning used by the pure force helper before scene-level balancing.
const DEFAULT_LIFT_MULTIPLIER = 0.00004;
const DEFAULT_DRAG_MULTIPLIER = 0.000025;
// Per-frame angular velocity adjustment applied by pitch control input.
const DEFAULT_PITCH_STEP = 0.004;
const DEFAULT_MAX_ANGULAR_VELOCITY = 0.06;
const DEFAULT_GLIDE_ALIGNMENT_MIN_SPEED = 0.4;
const DEFAULT_GLIDE_ALIGNMENT_MIN_TURN_RATE = 1.8;
const DEFAULT_GLIDE_ALIGNMENT_MAX_TURN_RATE = 4.2;

export const AERO_LOOKUP_TABLE: ReadonlyArray<readonly [number, AeroCoefficients]> = [
  [-10, { lift: -0.4, drag: 0.04 }],
  [-5, { lift: -0.2, drag: 0.025 }],
  [0, { lift: 0, drag: 0.02 }],
  [5, { lift: 0.4, drag: 0.025 }],
  [10, { lift: 0.8, drag: 0.04 }],
  [12, { lift: 1, drag: 0.06 }],
  [15, { lift: 0.9, drag: 0.1 }],
  [20, { lift: 0.5, drag: 0.2 }],
  [30, { lift: 0.2, drag: 0.4 }],
  [45, { lift: 0.1, drag: 0.6 }],
] as const;

function resolveStatProgress(statValue: number): number {
  return (clamp(statValue, MIN_STAT_VALUE, MAX_STAT_VALUE) - MIN_STAT_VALUE) / (MAX_STAT_VALUE - MIN_STAT_VALUE);
}

export function calculateStatBasedLaunchForce(speedStat: number, power: number, angleRadians: number): Vector2Like {
  const clampedSpeedStat = clamp(speedStat, MIN_STAT_VALUE, MAX_STAT_VALUE);
  const clampedPower = clamp(power, 0, 1);
  const magnitude = (BASE_LAUNCH_FORCE + clampedSpeedStat * SPEED_FORCE_MULTIPLIER) * clampedPower;

  return {
    x: Math.cos(angleRadians) * magnitude,
    y: Math.sin(angleRadians) * magnitude,
  };
}

export function calculateDragCoefficient(glideStat: number): number {
  return lerp(0.05, 0.01, resolveStatProgress(glideStat));
}

export function calculateAngularDamping(stabilityStat: number): number {
  return lerp(0.02, 0.2, resolveStatProgress(stabilityStat));
}

export function calculateMaxTorque(trickStat: number): number {
  return lerp(0.03, 0.09, resolveStatProgress(trickStat));
}

export function calculateCollisionRetention(durabilityStat: number): number {
  return lerp(0.3, 0.9, resolveStatProgress(durabilityStat));
}

export function calculateLaunchVector({
  anchor,
  dragPosition,
  speedStat = 6,
  maxDragDistance = DEFAULT_MAX_DRAG_DISTANCE,
}: LaunchVectorInput): LaunchVectorResult {
  const rawDragVector = subtractVectors(anchor, dragPosition);
  const rawDragDistance = vectorMagnitude(rawDragVector);
  const dragDistance = Math.min(rawDragDistance, maxDragDistance);
  const power = maxDragDistance === 0 ? 0 : dragDistance / maxDragDistance;

  if (dragDistance === 0) {
    return {
      force: { x: 0, y: 0 },
      dragDistance: 0,
      power: 0,
      angleRadians: 0,
    };
  }

  const direction = normalizeVector(rawDragVector);
  const angleRadians = Math.atan2(direction.y, direction.x);
  const force = calculateStatBasedLaunchForce(speedStat, power, angleRadians);

  return {
    force,
    dragDistance,
    power,
    angleRadians,
  };
}

export function calculateAngleOfAttackDegrees(airplaneAngleRadians: number, velocity: Vector2Like): number {
  if (vectorMagnitude(velocity) === 0) {
    return 0;
  }

  const airplaneAngleDegrees = radiansToDegrees(airplaneAngleRadians);
  const velocityAngleDegrees = radiansToDegrees(Math.atan2(velocity.y, velocity.x));

  return wrapAngleDegrees(airplaneAngleDegrees - velocityAngleDegrees);
}

export function getAerodynamicCoefficients(angleOfAttackDegrees: number): AeroCoefficients {
  const clampedAngle = clamp(angleOfAttackDegrees, MIN_AERO_ANGLE, MAX_AERO_ANGLE);

  for (let index = 0; index < AERO_LOOKUP_TABLE.length - 1; index += 1) {
    const [startAngle, startCoefficients] = AERO_LOOKUP_TABLE[index];
    const [endAngle, endCoefficients] = AERO_LOOKUP_TABLE[index + 1];

    if (clampedAngle >= startAngle && clampedAngle <= endAngle) {
      const progress = (clampedAngle - startAngle) / (endAngle - startAngle);

      return {
        lift: lerp(startCoefficients.lift, endCoefficients.lift, progress),
        drag: lerp(startCoefficients.drag, endCoefficients.drag, progress),
      };
    }
  }

  return AERO_LOOKUP_TABLE[AERO_LOOKUP_TABLE.length - 1][1];
}

export function calculateAerodynamicForce({
  airplaneAngleRadians,
  velocity,
  liftMultiplier = DEFAULT_LIFT_MULTIPLIER,
  dragMultiplier = DEFAULT_DRAG_MULTIPLIER,
  minSpeed = DEFAULT_MIN_AERODYNAMIC_SPEED,
}: AerodynamicForceInput): Vector2Like {
  const speed = vectorMagnitude(velocity);

  if (speed <= minSpeed) {
    return { x: 0, y: 0 };
  }

  const normalizedVelocity = normalizeVector(velocity);
  const angleOfAttack = calculateAngleOfAttackDegrees(airplaneAngleRadians, velocity);
  const coefficients = getAerodynamicCoefficients(angleOfAttack);
  const perpendicularLiftDirection = { x: normalizedVelocity.y, y: -normalizedVelocity.x };
  const dragDirection = scaleVector(normalizedVelocity, -1);
  const speedSquared = speed * speed;

  return addVectors(
    scaleVector(perpendicularLiftDirection, coefficients.lift * liftMultiplier * speedSquared),
    scaleVector(dragDirection, coefficients.drag * dragMultiplier * speedSquared),
  );
}

export function resolvePitchControlAngularVelocity({
  currentAngularVelocity,
  direction,
  step = DEFAULT_PITCH_STEP,
  maxAngularVelocity = DEFAULT_MAX_ANGULAR_VELOCITY,
}: PitchControlInput): number {
  if (direction === 'neutral') {
    return clamp(currentAngularVelocity, -maxAngularVelocity, maxAngularVelocity);
  }

  const delta = direction === 'up' ? -step : step;
  return clamp(currentAngularVelocity + delta, -maxAngularVelocity, maxAngularVelocity);
}

export function resolveGlideAlignmentRotation({
  currentRotationRadians,
  velocity,
  stabilityStat,
  deltaMs,
  minSpeed = DEFAULT_GLIDE_ALIGNMENT_MIN_SPEED,
  minTurnRateRadiansPerSecond = DEFAULT_GLIDE_ALIGNMENT_MIN_TURN_RATE,
  maxTurnRateRadiansPerSecond = DEFAULT_GLIDE_ALIGNMENT_MAX_TURN_RATE,
}: GlideAlignmentInput): number {
  const speed = vectorMagnitude(velocity);

  if (speed <= minSpeed || deltaMs <= 0) {
    // Skip auto-alignment when frame timing is invalid or the airplane is effectively stationary.
    return currentRotationRadians;
  }

  const targetRotationRadians = Math.atan2(velocity.y, velocity.x);
  const shortestAngleDelta = Math.atan2(
    Math.sin(targetRotationRadians - currentRotationRadians),
    Math.cos(targetRotationRadians - currentRotationRadians),
  );
  const maxTurnStep =
    lerp(
      minTurnRateRadiansPerSecond,
      maxTurnRateRadiansPerSecond,
      resolveStatProgress(stabilityStat),
    ) *
    (deltaMs / 1000);

  return currentRotationRadians + clamp(shortestAngleDelta, -maxTurnStep, maxTurnStep);
}

export function predictTrajectoryPoints({
  origin,
  launchForce,
  gravity = 0.5,
  gravityScale = DEFAULT_TRAJECTORY_GRAVITY_SCALE,
  steps = DEFAULT_TRAJECTORY_STEPS,
  timeStep = DEFAULT_TRAJECTORY_TIME_STEP,
  velocityScale = DEFAULT_TRAJECTORY_VELOCITY_SCALE,
}: TrajectoryPreviewInput): Vector2Like[] {
  const initialVelocity = scaleVector(launchForce, velocityScale);

  return Array.from({ length: steps }, (_, index) => {
    const time = (index + 1) * timeStep;

    return {
      x: origin.x + initialVelocity.x * time,
      y: origin.y + initialVelocity.y * time + 0.5 * gravity * gravityScale * time * time,
    };
  });
}
