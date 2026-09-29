import type { GameSession } from "../session/game-session";
import type { EnemyKind } from "../sim/types";

export interface PirateTestBridge {
  getState(): ReturnType<typeof snapshot>;
  advance(ms: number): ReturnType<typeof snapshot>;
  spawnEnemy(kind: EnemyKind, x: number, y: number, angle?: number): number;
  teleportPlayer(x: number, y: number, angle?: number): void;
  setPlayerHealth(health: number): void;
  stats(): ReturnType<GameSession["stats"]>;
}

declare global {
  interface Window {
    __pirate?: PirateTestBridge;
  }
}

function snapshot(session: GameSession) {
  const { state } = session;
  const round = (value: number) => Math.round(value * 100) / 100;
  const ship = (s: typeof state.player) => ({
    id: s.id,
    kind: s.kind,
    x: round(s.x),
    y: round(s.y),
    angle: round(s.angle),
    speed: round(s.speed),
    health: s.health,
    alive: s.alive,
    cooldowns: { ...s.cooldowns },
  });
  return {
    phase: state.phase,
    paused: session.hud.get().paused,
    countdown: round(state.countdown),
    elapsed: round(state.elapsed),
    remaining: round(state.remaining),
    score: state.score,
    endReason: state.endReason,
    player: ship(state.player),
    enemies: state.enemies.map(ship),
    projectiles: state.projectiles.map((p) => ({ id: p.id, side: p.side, x: round(p.x), y: round(p.y) })),
    spawnedByKind: { ...state.spawnedByKind },
    config: { sessionSeconds: session.matchConfig.match.durationSeconds, spawnSeconds: session.matchConfig.match.spawnIntervalSeconds },
  };
}

// só existe com ?e2e=1: observa o estado e controla o relógio, as regras continuam as reais
export function installTestBridge(session: GameSession) {
  window.__pirate = {
    getState: () => snapshot(session),
    advance(ms) {
      session.advance(ms / 1000);
      return snapshot(session);
    },
    spawnEnemy: (kind, x, y, angle) => session.spawnEnemyForTest(kind, x, y, angle),
    teleportPlayer(x, y, angle) {
      const { player } = session.state;
      player.x = player.prevX = x;
      player.y = player.prevY = y;
      if (angle !== undefined) player.angle = player.prevAngle = angle;
      player.speed = 0;
    },
    setPlayerHealth(health) {
      session.state.player.health = health;
    },
    stats: () => session.stats(),
  };
  return () => {
    if (window.__pirate) delete window.__pirate;
  };
}
