import { describe, expect, it } from 'vitest';

import {
  calculateAngleOfAttackDegrees,
  calculateAerodynamicForce,
  calculateAngularDamping,
  calculateCollisionRetention,
  calculateDragCoefficient,
  calculateLaunchVector,
  calculateMaxTorque,
  calculateStatBasedLaunchForce,
  getAerodynamicCoefficients,
  predictTrajectoryPoints,
  resolveGlideAlignmentRotation,
  resolvePitchControlAngularVelocity,
} from '@/systems/PhysicsSystem';

describe('PhysicsSystem', () => {
  it('derives launch power, angle, and force from drag distance', () => {
    const launch = calculateLaunchVector({
      anchor: { x: 100, y: 120 },
      dragPosition: { x: 10, y: 165 },
      speedStat: 6,
      maxDragDistance: 50,
    });

    expect(launch.power).toBe(1);
    expect(launch.dragDistance).toBe(50);
    expect(launch.force.x).toBeGreaterThan(0);
    expect(launch.force.y).toBeLessThan(0);
    expect(launch.angleRadians).toBeLessThan(0);
  });

  it('calculates angle of attack from plane heading and velocity', () => {
    expect(calculateAngleOfAttackDegrees(Math.PI / 4, { x: 10, y: 0 })).toBeCloseTo(45);
    expect(calculateAngleOfAttackDegrees(-Math.PI, { x: -10, y: 0 })).toBeCloseTo(0);
    expect(calculateAngleOfAttackDegrees(1, { x: 0, y: 0 })).toBe(0);
  });

  it('interpolates aerodynamic coefficients from the lookup table', () => {
    expect(getAerodynamicCoefficients(12)).toEqual({ lift: 1, drag: 0.06 });
    expect(getAerodynamicCoefficients(2.5)).toEqual({ lift: 0.2, drag: 0.0225 });
    expect(getAerodynamicCoefficients(90)).toEqual({ lift: 0.1, drag: 0.6 });
  });

  it('predicts a ballistic trajectory preview from launch force', () => {
    const points = predictTrajectoryPoints({
      origin: { x: 120, y: 180 },
      launchForce: { x: 0.004, y: -0.003 },
      steps: 4,
      timeStep: 0.1,
    });

    expect(points).toHaveLength(4);
    expect(points[0].x).toBeGreaterThan(120);
    expect(points[0].y).toBeLessThan(180);
    expect(points[3].x).toBeGreaterThan(points[1].x);
  });

  it('resolves aerodynamic force into upward lift and opposing drag', () => {
    const force = calculateAerodynamicForce({
      airplaneAngleRadians: Math.PI / 18,
      velocity: { x: 10, y: 0 },
    });

    expect(force.x).toBeLessThan(0);
    expect(force.y).toBeLessThan(0);
    expect(calculateAerodynamicForce({ airplaneAngleRadians: 0, velocity: { x: 0.05, y: 0 } })).toEqual({ x: 0, y: 0 });
  });

  it('adjusts pitch control angular velocity with clamping', () => {
    expect(resolvePitchControlAngularVelocity({ currentAngularVelocity: 0.01, direction: 'up' })).toBeLessThan(0.01);
    expect(resolvePitchControlAngularVelocity({ currentAngularVelocity: -0.01, direction: 'down' })).toBeGreaterThan(-0.01);
    expect(
      resolvePitchControlAngularVelocity({
        currentAngularVelocity: 0.059,
        direction: 'down',
        maxAngularVelocity: 0.06,
      }),
    ).toBe(0.06);
  });

  it('gradually aligns neutral flight rotation toward the velocity vector', () => {
    const lowStabilityRotation = resolveGlideAlignmentRotation({
      currentRotationRadians: 0,
      velocity: { x: 6, y: 6 },
      stabilityStat: 1,
      deltaMs: 100,
    });
    const highStabilityRotation = resolveGlideAlignmentRotation({
      currentRotationRadians: 0,
      velocity: { x: 6, y: 6 },
      stabilityStat: 10,
      deltaMs: 100,
    });

    expect(lowStabilityRotation).toBeGreaterThan(0);
    expect(highStabilityRotation).toBeGreaterThan(lowStabilityRotation);
    expect(highStabilityRotation).toBeLessThan(Math.PI / 4);
    expect(
      resolveGlideAlignmentRotation({
        currentRotationRadians: 0.4,
        velocity: { x: 0.1, y: 0.1 },
        stabilityStat: 10,
        deltaMs: 100,
      }),
    ).toBeCloseTo(0.4);
  });

  it('maps airplane stats into physical tuning values', () => {
    const slowLaunchForce = calculateStatBasedLaunchForce(1, 1, 0);
    const fastLaunchForce = calculateStatBasedLaunchForce(10, 1, 0);

    expect(fastLaunchForce.x).toBeGreaterThan(slowLaunchForce.x);
    expect(calculateDragCoefficient(1)).toBeCloseTo(0.05);
    expect(calculateDragCoefficient(10)).toBeCloseTo(0.01);
    expect(calculateAngularDamping(1)).toBeLessThan(calculateAngularDamping(10));
    expect(calculateAngularDamping(10)).toBeCloseTo(0.2);
    expect(calculateMaxTorque(10)).toBeGreaterThan(calculateMaxTorque(1));
    expect(calculateCollisionRetention(1)).toBeCloseTo(0.3);
    expect(calculateCollisionRetention(10)).toBeCloseTo(0.9);
  });
});
