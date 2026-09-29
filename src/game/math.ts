export interface Vec {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Vec, b: Vec) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function angleBetween(from: Vec, to: Vec) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// mantém o ângulo dentro de (-pi, pi]
export function wrapAngle(angle: number) {
  let wrapped = angle % TAU;
  if (wrapped > Math.PI) wrapped -= TAU;
  if (wrapped <= -Math.PI) wrapped += TAU;
  return wrapped;
}

export function angleDifference(from: number, to: number) {
  return wrapAngle(to - from);
}

export function direction(angle: number): Vec {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function approach(value: number, target: number, maxStep: number) {
  if (value < target) return Math.min(target, value + maxStep);
  return Math.max(target, value - maxStep);
}
