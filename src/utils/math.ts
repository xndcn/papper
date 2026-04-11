export interface Vector2Like {
  readonly x: number;
  readonly y: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

export function addVectors(a: Vector2Like, b: Vector2Like): Vector2Like {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractVectors(a: Vector2Like, b: Vector2Like): Vector2Like {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVector(vector: Vector2Like, scalar: number): Vector2Like {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

export function vectorMagnitude(vector: Vector2Like): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalizeVector(vector: Vector2Like): Vector2Like {
  const magnitude = vectorMagnitude(vector);

  if (magnitude === 0) {
    return { x: 0, y: 0 };
  }

  return scaleVector(vector, 1 / magnitude);
}

export function dotProduct(a: Vector2Like, b: Vector2Like): number {
  return a.x * b.x + a.y * b.y;
}

export function perpendicularVector(vector: Vector2Like): Vector2Like {
  return { x: -vector.y, y: vector.x };
}

export function radiansToDegrees(angleRadians: number): number {
  return (angleRadians * 180) / Math.PI;
}

export function wrapAngleDegrees(angle: number): number {
  return ((((angle + 180) % 360) + 360) % 360) - 180;
}
