import type { EnemyKind } from "./sim/types";

export interface CannonConfig {
  cooldown: number;
  damage: number;
  speed: number;
  range: number;
}

export interface BroadsideConfig extends CannonConfig {
  count: number;
  spacing: number;
}

export interface HullConfig {
  maxHealth: number;
  radius: number;
  maxSpeed: number;
  acceleration: number;
  drag: number;
  turnSpeed: number;
  // quão rápido o leme chega no giro máximo (rad/s²), dá inércia às curvas
  turnAcceleration: number;
  // quão rápido a direção de deslocamento alcança a proa, menor = mais deriva nas curvas
  grip: number;
}

export interface GameConfig {
  arena: { width: number; height: number };
  countdownSeconds: number;
  match: {
    durationSeconds: number;
    spawnIntervalSeconds: number;
    firstSpawnDelaySeconds: number;
    maxEnemies: number;
    spawnMinDistance: number;
    spawnBag: EnemyKind[];
  };
  player: HullConfig & {
    frontCannon: CannonConfig;
    broadside: BroadsideConfig;
  };
  chaser: HullConfig & {
    impactDamage: number;
  };
  shooter: HullConfig & {
    attackRange: number;
    preferredDistance: number;
    aimTolerance: number;
    cannon: CannonConfig;
  };
  projectileRadius: number;
}

export interface MatchOptions {
  sessionSeconds: number;
  spawnSeconds: number;
}

export const OPTION_LIMITS = {
  sessionSeconds: { min: 60, max: 180, step: 10, fallback: 120 },
  spawnSeconds: { min: 1, max: 10, step: 0.5, fallback: 3 },
} as const;

export const BASE_CONFIG: GameConfig = {
  arena: { width: 1600, height: 896 },
  countdownSeconds: 3,
  match: {
    durationSeconds: OPTION_LIMITS.sessionSeconds.fallback,
    spawnIntervalSeconds: OPTION_LIMITS.spawnSeconds.fallback,
    firstSpawnDelaySeconds: 1.5,
    maxEnemies: 10,
    spawnMinDistance: 520,
    // um saco embaralhado garante os dois tipos de inimigo em toda partida
    spawnBag: ["chaser", "shooter", "chaser", "shooter", "chaser"],
  },
  player: {
    maxHealth: 100,
    radius: 26,
    maxSpeed: 190,
    acceleration: 300,
    drag: 200,
    turnSpeed: 3.3,
    turnAcceleration: 20,
    grip: 13,
    frontCannon: { cooldown: 0.4, damage: 34, speed: 560, range: 520 },
    broadside: { cooldown: 1.1, damage: 34, speed: 480, range: 380, count: 3, spacing: 22 },
  },
  chaser: {
    maxHealth: 60,
    radius: 22,
    maxSpeed: 150,
    acceleration: 180,
    drag: 120,
    turnSpeed: 2.1,
    turnAcceleration: 9,
    grip: 12,
    impactDamage: 25,
  },
  shooter: {
    maxHealth: 100,
    radius: 26,
    maxSpeed: 110,
    acceleration: 140,
    drag: 120,
    turnSpeed: 1.7,
    turnAcceleration: 7,
    grip: 10,
    attackRange: 430,
    preferredDistance: 300,
    aimTolerance: 0.2,
    cannon: { cooldown: 1.9, damage: 10, speed: 420, range: 480 },
  },
  projectileRadius: 5,
};

function clampToStep(value: number, limits: { min: number; max: number; step: number; fallback: number }) {
  if (!Number.isFinite(value)) return limits.fallback;
  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  return Math.round(clamped / limits.step) * limits.step;
}

export function normalizeMatchOptions(options: Partial<MatchOptions>): MatchOptions {
  return {
    sessionSeconds: clampToStep(options.sessionSeconds ?? NaN, OPTION_LIMITS.sessionSeconds),
    spawnSeconds: clampToStep(options.spawnSeconds ?? NaN, OPTION_LIMITS.spawnSeconds),
  };
}

// cada partida usa uma cópia congelada, mudar as opções só vale pra próxima
export function createMatchConfig(options: MatchOptions, overrides: Partial<Pick<GameConfig, "countdownSeconds">> = {}): GameConfig {
  const safe = normalizeMatchOptions(options);
  const config = structuredClone(BASE_CONFIG);
  config.match.durationSeconds = safe.sessionSeconds;
  config.match.spawnIntervalSeconds = safe.spawnSeconds;
  if (overrides.countdownSeconds !== undefined) config.countdownSeconds = overrides.countdownSeconds;
  return Object.freeze(config);
}
