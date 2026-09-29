export type EnemyKind = "chaser" | "shooter";
export type ShipKind = "player" | EnemyKind;
export type Side = "player" | "enemy";
export type Weapon = "front" | "left" | "right";
export type EndReason = "time" | "destroyed";
export type MatchPhase = "countdown" | "running" | "ended";

export interface Ship {
  id: number;
  kind: ShipKind;
  x: number;
  y: number;
  angle: number;
  // pose no passo anterior, o render interpola entre ela e a atual
  prevX: number;
  prevY: number;
  prevAngle: number;
  speed: number;
  // velocidade de giro atual do leme (rad/s)
  turnRate: number;
  // direção em que o casco realmente se desloca, fica um pouco atrás da proa nas curvas
  course: number;
  health: number;
  maxHealth: number;
  radius: number;
  alive: boolean;
  cooldowns: Record<Weapon, number>;
  // lado escolhido pra contornar obstáculos: -1, 0 (rumo livre) ou 1
  detour: number;
  // rota até o alvo quando uma ilha está no caminho, recalculada de tempos em tempos
  route: { x: number; y: number }[];
  routeTimer: number;
}

export interface Projectile {
  id: number;
  side: Side;
  ownerId: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  damage: number;
  travelled: number;
  range: number;
  radius: number;
}

export interface Controls {
  forward: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  fireFront: boolean;
  fireLeft: boolean;
  fireRight: boolean;
  // joystick de toque: pra onde o jogador quer ir (ângulo do mundo) e com que força (0 a 1)
  stick: { angle: number; power: number } | null;
}

export const IDLE_CONTROLS: Readonly<Controls> = Object.freeze({
  forward: false,
  turnLeft: false,
  turnRight: false,
  fireFront: false,
  fireLeft: false,
  fireRight: false,
  stick: null,
});

export interface MatchState {
  phase: MatchPhase;
  countdown: number;
  elapsed: number;
  remaining: number;
  score: number;
  endReason: EndReason | null;
  player: Ship;
  enemies: Ship[];
  projectiles: Projectile[];
  spawnTimer: number;
  spawnBag: EnemyKind[];
  spawnedByKind: Record<EnemyKind, number>;
}

export type GameEvent =
  | { type: "countdown"; value: number }
  | { type: "matchStarted" }
  | { type: "shot"; side: Side; weapon: Weapon; shipId: number; x: number; y: number; angle: number }
  | { type: "hit"; side: Side; shipId: number; x: number; y: number; damage: number; health: number }
  | { type: "splash"; x: number; y: number; onShore: boolean }
  | { type: "bump"; shipId: number; x: number; y: number }
  | { type: "enemySpawned"; shipId: number; kind: EnemyKind; x: number; y: number }
  | { type: "shipDestroyed"; shipId: number; kind: ShipKind; x: number; y: number; angle: number; cause: "cannon" | "impact" }
  | { type: "scored"; score: number }
  | { type: "matchEnded"; reason: EndReason; score: number; elapsed: number };
