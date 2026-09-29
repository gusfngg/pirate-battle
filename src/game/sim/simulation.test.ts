import { describe, expect, it } from "vitest";
import { createMatchConfig, type MatchOptions } from "../config";
import { distance } from "../math";
import { ARENA_LAYOUT } from "../world/layout";
import { Simulation } from "./simulation";
import { IDLE_CONTROLS, type Controls, type GameEvent } from "./types";

const STEP = 1 / 60;
const UP = -Math.PI / 2;

// o jogador nasce em (800, 430) olhando pra cima e o primeiro inimigo só chega aos 1.5s
function createMatch(options: MatchOptions = { sessionSeconds: 60, spawnSeconds: 10 }, seed = 1) {
  return new Simulation({ config: createMatchConfig(options, { countdownSeconds: 0 }), layout: ARENA_LAYOUT, seed });
}

function run(simulation: Simulation, seconds: number, controls: Partial<Controls> = {}) {
  const input = { ...IDLE_CONTROLS, ...controls };
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    simulation.step(STEP, input);
    events.push(...simulation.drainEvents());
  }
  return events;
}

function count(events: GameEvent[], type: GameEvent["type"]) {
  return events.filter((event) => event.type === type).length;
}

describe("combat", () => {
  it("a full broadside sinks a shooter and scores exactly one point", () => {
    const match = createMatch();
    match.spawnEnemyAt("shooter", 660, 430, Math.PI / 2);
    const events = [...run(match, STEP, { fireLeft: true }), ...run(match, 0.6)];

    expect(match.state.enemies).toHaveLength(0);
    expect(match.state.score).toBe(1);
    expect(count(events, "scored")).toBe(1);
  });

  it("each ball deals its damage once and disappears", () => {
    const match = createMatch();
    const chaser = match.spawnEnemyAt("chaser", 800, 250, UP);
    run(match, STEP, { fireFront: true });
    const events = run(match, 0.5);

    expect(chaser.health).toBe(60 - 34);
    expect(count(events, "hit")).toBe(1);
    expect(match.state.projectiles.filter((ball) => ball.side === "player")).toHaveLength(0);
  });

  it("a chaser ramming the player explodes and gives no point", () => {
    const match = createMatch();
    match.spawnEnemyAt("chaser", 800, 330, Math.PI / 2);
    const events = run(match, 1.2);

    expect(match.state.player.health).toBe(75);
    expect(match.state.score).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "shipDestroyed", kind: "chaser", cause: "impact" }));
  });

  it("holding the bow cannon for one second fires on its cooldown", () => {
    const match = createMatch();
    const shots = run(match, 1, { fireFront: true }).filter((event) => event.type === "shot");
    // recarga de 0.4s: tiros em 0, 0.4 e 0.8
    expect(shots).toHaveLength(3);
  });

  it("islands stop cannon balls", () => {
    const match = createMatch();
    Object.assign(match.state.player, { x: 560, y: 660, angle: Math.PI });
    const events = [...run(match, STEP, { fireFront: true }), ...run(match, 0.4)];

    expect(events).toContainEqual(expect.objectContaining({ type: "splash", onShore: true }));
    expect(match.state.projectiles).toHaveLength(0);
  });
});

describe("movement", () => {
  it("a ship cannot sail through an island", () => {
    const match = createMatch();
    Object.assign(match.state.player, { x: 256, y: 460, angle: UP });
    run(match, 2.5, { forward: true });
    // a ilha palm-grove ocupa y 64..320
    expect(match.state.player.y).toBeGreaterThan(320);
  });

  it("a ship stays inside the arena", () => {
    const match = createMatch();
    Object.assign(match.state.player, { x: 1500, y: 700, angle: 0 });
    run(match, 2.5, { forward: true });
    expect(match.state.player.x).toBeLessThanOrEqual(1600 - match.state.player.radius);
  });
});

describe("enemy navigation", () => {
  // jogador e chaser separados por uma ilha: sem rota ele ficaria preso na praia
  const blocked = [
    { name: "below turtle isle", player: { x: 1000, y: 440 }, chaser: { x: 1000, y: 850 } },
    { name: "above palm grove", player: { x: 256, y: 470 }, chaser: { x: 256, y: 30 } },
    { name: "behind skull beach", player: { x: 540, y: 690 }, chaser: { x: 60, y: 690 } },
    { name: "across the north sandbank", player: { x: 1300, y: 150 }, chaser: { x: 1300 + 300, y: 150 } },
  ];

  for (const scene of blocked) {
    it(`a chaser reaches the player from ${scene.name}`, () => {
      const match = createMatch();
      Object.assign(match.state.player, scene.player);
      match.spawnEnemyAt("chaser", Math.min(scene.chaser.x, 1570), scene.chaser.y, 0);
      // parado no lugar, só o chaser se mexe; 1.4s por vez pra não deixar o spawner entrar em cena
      let hit = false;
      for (let chunk = 0; chunk < 6 && !hit; chunk++) {
        match.state.spawnTimer = 99;
        hit = run(match, 1.4).some((event) => event.type === "hit" && event.side === "player");
      }
      expect(hit).toBe(true);
    });
  }
});

describe("match end", () => {
  it("ends by time and freezes every system", () => {
    const match = createMatch({ sessionSeconds: 60, spawnSeconds: 3 });
    for (let second = 0; second < 61 && match.state.phase !== "ended"; second++) {
      match.state.player.health = 100;
      run(match, 1, { forward: true, turnLeft: true, fireFront: true });
    }
    expect(match.state.phase).toBe("ended");
    expect(match.state.endReason).toBe("time");

    const frozen = JSON.stringify(match.state);
    const events = run(match, 3, { forward: true, fireFront: true, fireLeft: true });
    expect(JSON.stringify(match.state)).toBe(frozen);
    expect(events).toHaveLength(0);
  });

  it("ends when the player is destroyed", () => {
    const match = createMatch();
    match.state.player.health = 20;
    match.spawnEnemyAt("chaser", 800, 330, Math.PI / 2);
    const events = run(match, 1.2);

    expect(match.state.phase).toBe("ended");
    expect(match.state.endReason).toBe("destroyed");
    expect(events).toContainEqual(expect.objectContaining({ type: "matchEnded", reason: "destroyed" }));
  });
});

describe("spawner", () => {
  it("spawns on the configured interval, far from the player, with both kinds", () => {
    const match = createMatch({ sessionSeconds: 60, spawnSeconds: 2 });
    const spawned: { x: number; y: number }[] = [];
    const record = (events: GameEvent[]) => {
      for (const event of events) if (event.type === "enemySpawned") spawned.push(event);
    };

    record(run(match, 1.4));
    expect(spawned).toHaveLength(0);
    record(run(match, 0.2));
    expect(spawned).toHaveLength(1);
    record(run(match, 8));
    expect(spawned).toHaveLength(5);

    const { chaser, shooter } = match.state.spawnedByKind;
    expect(chaser).toBeGreaterThan(0);
    expect(shooter).toBeGreaterThan(0);
  });

  it("never spawns inside the minimum distance", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const match = createMatch({ sessionSeconds: 60, spawnSeconds: 1 }, seed);
      for (let second = 0; second < 8; second++) {
        match.state.player.health = 100;
        for (const event of run(match, 1)) {
          if (event.type === "enemySpawned") expect(distance(event, match.state.player)).toBeGreaterThan(400);
        }
      }
    }
  });
});

describe("determinism", () => {
  it("the same seed and inputs replay the same match", () => {
    const script = (match: Simulation) => {
      for (let second = 0; second < 20; second++) {
        run(match, 1, { forward: true, turnRight: second % 4 < 2, fireFront: true, fireLeft: second % 3 === 0 });
      }
      return JSON.stringify(match.state);
    };
    expect(script(createMatch(undefined, 42))).toBe(script(createMatch(undefined, 42)));
    expect(script(createMatch(undefined, 42))).not.toBe(script(createMatch(undefined, 43)));
  });
});
