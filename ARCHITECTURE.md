# Architecture

Pirate Battle is split along one idea: **the simulation owns the truth, everything else reads it.** The rules of the match are plain TypeScript with no PixiJS and no React. PixiJS draws what the simulation says. React draws the menus and a thin HUD that only hears about values that actually changed. Input is collected in one place and handed to the simulation once per step.

```
 keyboard ─┐
 touch ────┴─> ControlPad ──snapshot──> Simulation.step(dt) ──events──> GameRenderer (PixiJS)
                                             │                    └──> SoundBoard (Web Audio)
                                             └──> HUD store ──(only on change)──> React HUD
```

## React and PixiJS

`PlayScreen` (React) loads the textures, then mounts a `GameStage` that creates a `GameSession` inside an effect and destroys it in the cleanup. The session is the only object that talks to PixiJS:

- it creates the `Application` (asynchronous `init`), appends the canvas to a host `div`, and adds its ticker callback;
- it builds a `GameRenderer` for the current match;
- it binds keyboard, blur and visibility listeners;
- it owns the fixed step loop and the HUD store.

**Strict Mode.** React mounts, unmounts and mounts again in development. `Application.init` is asynchronous, so the first session can be destroyed while Pixi is still starting. `mount()` checks a `destroyed` flag after the `await` and tears the fresh application down immediately if the component already left. The second mount then creates its own session, so there is never more than one canvas (a test walks between screens four times and checks exactly that).

**No React render per frame.** The HUD reads a tiny external store (`src/lib/store.ts`) through `useSyncExternalStore` with selectors. The session writes to it after every simulation step, but `set` compares the patch shallowly, so React only re-renders when health, score, the whole second on the clock, the phase or the countdown number really change. Continuous state, such as positions, angles and projectiles, never leaves the simulation.

**Screen fit.** The arena is 1600 x 896 world units (25 x 14 tiles of 64). The renderer scales a world container with a *contain* fit and centres it, so proportions are preserved on any screen. The water tiling sprite is sized in world units to cover the whole canvas, so the letterbox bands still look like open sea while the arena edge stays visible as a darker frame. The canvas uses `resolution = min(devicePixelRatio, 2)` with `autoDensity`, and a `ResizeObserver` on the host resizes both the renderer and the fit. Input never goes through canvas coordinates (keys and DOM buttons only), so resizing cannot skew controls.

## The simulation

`src/game/sim/simulation.ts` holds a `MatchState` and advances it with `step(dt, controls)`. Its phases are `countdown`, `running` and `ended`.

**Fixed time step.** The session feeds real frame time into `FixedStepLoop`, an accumulator that calls `step(1/60)` as many times as needed. A frame longer than 250 ms is clamped, so a hiccup never becomes a teleport. Movement, cooldowns, projectile travel, spawn timers and the match clock all use `dt`, which makes the game independent of the display rate: a 120 Hz monitor and a 30 fps phone play the same match. In test mode the ticker keeps rendering but only the test bridge advances the loop.

**Order of a step:** player (cooldowns, steering, sailing, firing), spawner, enemies (AI, sailing, ship to ship separation), projectiles (travel, hits, islands, range), cleanup of sunk enemies, then the end check. Destroyed enemies are removed in the same step they sink, so they cannot fire, ram or collide again.

**Events.** Anything the outside world might care about (a shot, a hit, a splash, a bump, a spawn, a sinking, a point, the end) is pushed into an event queue. The session drains it once per frame and hands the list to the renderer, the sound board and the end of match handler. The simulation never calls them directly.

**Ending.** When the player's health reaches zero or the clock reaches zero, the phase becomes `ended`, projectiles are cleared and `step` returns immediately from then on. Movement, firing, damage, spawns and scoring all stop because nothing runs anymore. The session waits 1.6 s so the final explosion is visible, then hands a summary to the result flow.

**Scoring.** `sinkByCannon` is the only function that adds a point, and only while the phase is `running`. A Chaser that rams the player dies through `destroyShip` with the cause `impact`, which scores nothing.

## Movement and collisions

Ships have a heading, a scalar speed and a radius. Throttle accelerates towards the maximum speed, releasing it applies drag. Turning keeps 55% of the rudder even when standing still, so a ship can always point away from trouble.

The world has two obstacle shapes, both built from the layout JSON in `src/game/world/`:

- **Islands** are rounded rectangles, inset a little from the tiles because the sand art fades out at its rim. A contact is found by clamping the ship centre into the inner rectangle and measuring against the corner radius, which gives a smooth normal along edges and round corners.
- **Rocks** are circles.

After moving, a ship is pushed out along each contact normal by the overlap depth, then clamped to the arena bounds. Only the part of the motion that goes into the obstacle is damped (`speed *= 1 - 0.45 * impact`, where `impact` is how head-on the hit was). Grazing a shore keeps you sailing, while ramming it stops you. Ships push each other apart symmetrically so hulls never overlap.

Projectiles are points with a small radius. Each step they move, then check the opposite side's ships, then obstacles, then the arena bounds, then their range. The first thing they touch removes them, so a ball can only ever deal damage once. A broadside is three independent balls, which is why three hits on one Shooter still count as a single point: the ship sinks on the ball that empties its health and the others find no living target.

## Enemies

**Chaser.** Steers straight at the player and slows down when the turn needed is large. To get around islands it probes a point 110 units ahead (and one at half that distance) on the desired heading. If that point is blocked, it opens a fan of headings in steps of 0.35 rad. The first time it is blocked it picks the side with the smallest clear deviation, then **commits** to that side until the direct heading is clear again. Without the commitment it used to flip sides every frame behind wide islands and stall. On contact with the player it deals 25 damage and explodes.

**Shooter.** Closes in with the same obstacle avoidance while it is farther than 300 units, then eases off the throttle and turns to aim. It aims slightly ahead of the player (60% of the true lead), so sailing in a straight line is not safe but dodging works. It fires its bow cannon when within 430 units and within 0.2 rad of the aim.

**Spawner.** The first enemy appears 1.5 s into the match, then one per configured interval, up to 10 alive at once. Kinds come from a shuffled bag of three Chasers and two Shooters, so both kinds appear in every standard match and streaks are bounded. Spawn points are picked on a margin inside the arena edges, must be on open water with clearance from obstacles and other ships, and must be at least 520 units from the player. After 40 tries the farthest valid point wins, and if none is valid the spawn retries 0.25 s later.

## Rendering and resource management

**Loading.** `loadGameAssets` loads three spritesheets with `Assets.load` and reports progress to a store that the loading panel shows. The tiles and UI atlases switch to their `@2x` versions on dense screens. Before a match may start, the result is validated against the list of frames the renderer needs. A failed load clears the in-flight promise, and the next attempt adds a `?retry=n` query so nothing cached by the browser or Pixi from the broken attempt is reused. Concurrent callers share one promise, which also covers Strict Mode's double effect.

**Reuse.** Textures are loaded once per page and shared by every match. Destroying a match destroys display objects (`children: true`) but never textures, so the second match starts instantly and does not reupload anything to the GPU.

**Layers**, from bottom to top: water (a `TilingSprite` that drifts slowly), foam wakes (one `Graphics` redrawn per frame), the static ground (shallows, island tiles, decor, rocks) baked once with `cacheAsTexture`, sinking wrecks and splashes, hulls, cannon balls with their trails, explosions and debris, and finally health bars, which live in their own layer so they never rotate with the hull.

**Ships** swap textures by damage stage (intact, damaged, heavily damaged, wreck), show flickering fire from the damaged stage on, and flash red on a hit. The health bar crops a sub-texture of the fill art instead of scaling it, so the rounded end keeps its shape. The cropped texture is only rebuilt when health changes and the previous one is destroyed.

**Cannon balls** come from a pool of sprites keyed by projectile id; a sprite goes back to the pool when its projectile disappears. **Effects** are short lived objects created from events and destroyed when their time runs out. They use a seeded random generator, so visual regression screenshots stay stable.

**Teardown** (`GameSession.destroy`): clears the end timer, removes keyboard, blur and visibility listeners, disconnects the resize observer, stops sound loops, removes the ticker callback, destroys the renderer and finally the application with `removeView`. `restart()` rebuilds the simulation and renderer inside the same application. The memory profile in `PERFORMANCE.md` checks that five play and leave cycles do not keep growing.

## Input

Keyboard and touch both write into a `ControlPad`, which tracks for every action the set of *sources* holding it. Each touch pointer is its own source, so two thumbs can sail and fire at the same time and lifting one never releases the other. The keyboard binding only reacts while a match is live and the target is not a text field, calls `preventDefault` only for game keys, and releases its keys on window blur. Pausing and resuming call `releaseAll()` and reset the loop accumulator, so a key held through a pause does nothing until it is pressed again and no time is "caught up" after the pause.

## Pause

Pause can be triggered by the pause button, `Esc`/`P`, the window losing focus, the tab being hidden, or a phone being turned upright. While paused the ticker keeps drawing the frozen scene, but no step runs: the match clock, cooldowns, spawn timer and projectiles all stand still. Resuming always needs an explicit action in the pause dialog (a native `<dialog>`, which traps focus, closes on `Esc` and restores focus afterwards).

## Local persistence

| Key | Content |
| --- | --- |
| `pirate-battle:options` | Session and spawn time, validated again on read |
| `pirate-battle:player` | Player id (a UUID created once per browser) and captain name |
| `pirate-battle:last-result` | The last completed match, shown by the result screen after a refresh |
| `pirate-battle:outbox` | Completed matches waiting for the server, plus ids recently confirmed |
| `pirate-battle:network` | The selected mock scenario |
| `pirate-battle:mock-db` | Matches the mock server has confirmed |
| `pirate-battle:muted` | Sound preference |

Everything read from storage passes through validation, and every storage access is wrapped so a blocked or full storage degrades to in-memory behaviour instead of crashing. A refresh on `#/play` sends the player back to the menu: the match in progress is abandoned and never recorded.

## Ranking and history

**Contracts** (`src/api/contracts.ts`) are shared by the app, the MSW handlers and the tests:

```ts
interface MatchRecord {
  matchId: string;            // uuid created when the match ends
  playerId: string;
  playerName: string;
  playedAt: string;           // ISO date
  score: number;
  durationMs: number;         // effective play time
  endReason: "time" | "destroyed";
  config: { sessionSeconds: number; spawnSeconds: number };
}
interface Page<T> { items: T[]; page: number; pageSize: number; totalItems: number; totalPages: number }
```

| Endpoint | Purpose |
| --- | --- |
| `GET /api/ranking?sessionSeconds&spawnSeconds&page` | Matches with exactly that setup, ranked, 5 per page |
| `GET /api/players/:playerId/matches?page` | The player's matches, newest first |
| `PUT /api/matches/:matchId` | Register a match. Idempotent: 201 `{ record, created: true }` the first time, 200 with the stored record afterwards |

**Ranking order** is deterministic: more points first, then the longer effective duration (surviving the whole clock beats sinking with the same score), then the earlier match, then the match id.

**Axios** (`src/api/http.ts`) uses `/api` as base URL and a 5 s timeout, and an interceptor maps every failure into an `ApiError` with a kind (`timeout`, `offline`, `server`, `client`, `cancelled`) and a readable message. The UI never sees raw Axios errors.

**TanStack Query** holds the two lists. Query keys include every input (`["ranking", sessionSeconds, spawnSeconds, page]`, `["history", playerId, page]`). Queries keep the previous page as placeholder while the next one loads, refetch every time a tab is shown (`refetchOnMount: "always"`) and on window focus, and retry twice with backoff only for timeouts, network errors and 5xx (a 4xx will not fix itself). The screens render distinct states for first load, empty, error with retry, background refresh ("updating…") and a failed background refresh that keeps showing the last good data.

**Late answers.** Each query passes its `AbortSignal` to Axios. When a query is invalidated or refetched, the previous request is cancelled, and each page is cached under its own key. A slow answer for page 3 can only land in page 3's cache, never on the page currently on screen. A test pages forward and back under the `out-of-order` scenario to check this.

**Registration and the outbox.** When a match ends, the record is first written to the local outbox and only then sent. `useMatchSync` (mounted once at the app root) drains the outbox with a TanStack mutation: on start up, when the browser comes back online, every 10 s while something is pending, and when the player presses Retry. Each record is sent with `PUT` to its own id, so a retry after a timeout returns the record the server already stored instead of creating a second one. Success removes the record from the outbox and invalidates both the ranking and the history, so both tabs show it the next time they are opened. Failures stay in the outbox with their last error, the result screen explains it, and the player can start another match at any time. The ranking and history are the only network features: a dead API never blocks the menus, the options or a match.

## Mocks

MSW runs in the browser through its service worker in every build, including the deployed one. `main.tsx` waits for the worker before rendering. If the worker cannot start, the game renders anyway and only the captain's log reports the failure.

- `fixtures.ts` creates 28 matches from twelve captains across three setups with a fixed seed and fixed dates, enough for four ranking pages in the default setup.
- `db.ts` merges the fixtures with matches confirmed in this browser (persisted), and implements ranking, history and idempotent registration.
- `scenarios.ts` holds the scenario list, the current choice (from `?network=` or storage) and a seeded latency generator.
- `handlers.ts` applies the scenario (delay, network error, HTTP error) before running the real handler. In `register-timeout-after-commit` it stores the match *first* and then delays its answer past the client timeout, which is exactly the case where a naive retry would duplicate a record.
- `NetworkLab.tsx` is the in-game panel to switch scenarios and reset everything.

## Test instrumentation

With `?e2e=1` the session uses a manual clock and `window.__pirate` exposes `getState`, `advance(ms)`, `spawnEnemy`, `teleportPlayer`, `setPlayerHealth` and renderer `stats`. `advance` runs the real `step` with the real control snapshot, so tests drive the ship with actual key presses and observe the outcome. Staging helpers only place things; they never bypass a rule. Without the flag the bridge does not exist.

## Balancing decisions

| Value | Number | Why |
| --- | --- | --- |
| Player health | 100 | Four Chaser rams or ten Shooter hits. A careless run lasts about 20 s, a careful one survives the whole clock |
| Bow cannon | 34 damage, 0.4 s cooldown, 520 range | Precise and fast. Two shots sink a Chaser, three sink a Shooter |
| Broadside | 3 x 34 damage, 1.1 s cooldown, 380 range | One full broadside sinks anything, but it asks you to turn side on, which is risky against Chasers |
| Chaser | 60 health, 150 speed, 25 impact | Faster than the Shooter but slower than the player (190), so good sailing escapes it |
| Shooter | 100 health, 110 speed, 10 damage, 1.9 s cooldown | Tanky and slow. Its lead aim punishes straight lines while turning dodges it |
| Spawn bag | 3 Chasers, 2 Shooters | Guarantees both kinds in a standard match and pressure from rammers |
| Minimum spawn distance | 520 | Longer than any enemy weapon range, so no damage is unavoidable on arrival |
| Enemy cap | 10 alive | Keeps the 1 second spawn setting readable and the frame time flat |

## Limitations

- The simulation step is fixed at 60 Hz and rendering is not interpolated. On displays faster than 60 Hz a frame occasionally shows the same state twice, which is invisible at these speeds.
- Enemy avoidance looks ahead a fixed distance. It handles the islands in this arena, but it is not general path finding. A maze would need a navigation grid.
- The Shooter aims with its bow only and has no broadsides.
- The mock server lives in the same browser as the game, so "other players" are fixtures, and clearing site data also clears the mock database.
- Audio starts after the first click or key press, as browsers require. Sound failures are silent on purpose.
- In test mode the profiler keeps the player alive by refilling health once per second, so the three minute run measures a busy battle rather than an early defeat.
