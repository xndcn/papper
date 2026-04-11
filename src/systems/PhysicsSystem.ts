import {
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

const MIN_STAT = 1;
const MAX_STAT = 10;
const DEFAULT_MAX_DRAG_DISTANCE = 72;
const BASE_LAUNCH_FORCE = 0.0015;
const SPEED_FORCE_MULTIPLIER = 0.00045;
const DEFAULT_TRAJECTORY_STEPS = 14;
const DEFAULT_TRAJECTORY_TIME_STEP = 0.08;
const DEFAULT_TRAJECTORY_VELOCITY_SCALE = 22000;
const DEFAULT_TRAJECTORY_GRAVITY_SCALE = 320;
const MIN_AERO_ANGLE = -10;
const MAX_AERO_ANGLE = 45;

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
  const clampedSpeedStat = clamp(speedStat, MIN_STAT, MAX_STAT);
  const forceMagnitude = (BASE_LAUNCH_FORCE + clampedSpeedStat * SPEED_FORCE_MULTIPLIER) * power;

  return {
    force: scaleVector(direction, forceMagnitude),
    dragDistance,
    power,
    angleRadians: Math.atan2(direction.y, direction.x),
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
