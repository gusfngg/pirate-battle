# Pirate Battle

A top down naval shooter for the browser. You command a red crossed ship among islands and rocks, trade cannon fire with Shooters, dodge the Chasers that ram you, and sink as many enemies as you can before the clock runs out.

Built with **React 19**, **TypeScript** (strict), **PixiJS 8**, **TanStack Query 5**, **Axios**, **MSW 2** and **Playwright**.

- Live build: https://pirate-battle-phi.vercel.app
- Repository: https://github.com/gusfngg/pirate-battle
- How it is put together: [ARCHITECTURE.md](ARCHITECTURE.md)
- Measured performance: [PERFORMANCE.md](PERFORMANCE.md)
- Original brief: [CHALLENGE.md](CHALLENGE.md)

## Quick start

Requirements: Node.js 20.19 or newer and npm.

```bash
npm ci
npx playwright install chromium   # only needed for the tests
npm run dev                       # http://localhost:5173
```

`npm run dev` and `npm run build` first run `npm run assets`, which turns the raw files in `assets/` into what the game loads from `public/game/` (Pixi spritesheets, retina variants, loose UI images and sounds). That folder is generated, so it is not committed.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type check and optimized production build in `dist/` |
| `npm run preview` | Serves the production build on port 4173 |
| `npm run lint` | ESLint over the whole project |
| `npm run typecheck` | TypeScript project check (app, config and tests) |
| `npm run test:e2e` | Full Playwright suite, desktop and mobile Chromium, against the production build |
| `npm run test:e2e:update` | Refreshes the visual baselines after an intended visual change |
| `npm run test:e2e:report` | Opens the last HTML report |
| `npm run perf` | Three minute match profile and memory cycles, results in `docs/perf/` |
| `npm run assets` | Regenerates `public/game/` from `assets/` |

## Environment variables

None. The game has no backend: ranking and history live behind MSW mocks that run in every build, including the deployed one. Everything a tester might want to tune goes through URL parameters instead:

| Parameter | Example | Effect |
| --- | --- | --- |
| `network` | `?network=timeout` | Starts with a network scenario selected (see below) |
| `latency` | `?latency=0` | Fixes the mock latency in milliseconds for the calm scenarios |
| `netseed` | `?netseed=3` | Seeds the random latency of the jitter scenario |
| `e2e` | `?e2e=1` | Test mode: exposes `window.__pirate` and runs the simulation on a manual clock |
| `clock` | `?e2e=1&clock=real` | Test mode with the real clock (used by the profiler) |
| `seed` | `?seed=42` | Fixed seed for spawns and effects, the same seed plays the same match |
| `countdown` | `?countdown=0` | Overrides the three second countdown |

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Sail forward | `W` or `↑` | Up arrow button (left cluster) |
| Turn left / right | `A` `D` or `←` `→` | Curved arrow buttons (left cluster) |
| Bow cannon (one ball) | `Space` or `K` | Middle button (right cluster) |
| Left broadside (three balls) | `Q` or `J` | Left cannon button |
| Right broadside (three balls) | `E` or `L` | Right cannon button |
| Pause | `Esc` or `P` | Pause button, top right |

Moving, turning and firing all combine. Game keys are only captured while a match is live, so menus and text fields keep their usual keyboard behaviour. On phones the game is played in landscape; turning the phone upright pauses the battle and asks you to rotate back.

## Gameplay configuration

The Options screen exposes the two values the brief asks for, both validated and saved in `localStorage`:

| Option | Range | Step | Default |
| --- | --- | --- | --- |
| Game session time | 60 to 180 seconds | 10 | 120 |
| Enemy spawn time | 1 to 10 seconds | 0.5 | 3 |

It also lets you rename your captain (2 to 18 characters), which is the name the ranking shows.

Every other number lives in one typed object, `BASE_CONFIG` in [`src/game/config.ts`](src/game/config.ts): hull health, speed, acceleration, drag and turn rate per ship type, cannon damage, speed, range and cooldown, the broadside ball count and spacing, the Shooter attack range and preferred distance, the Chaser impact damage, the spawn bag, first spawn delay, enemy cap and minimum spawn distance. Systems read from the config and never hard code a value, so rebalancing is a matter of editing numbers. A match copies and freezes the config when it starts; changing options mid match only affects the next one.

## Network scenarios

Open **Network lab** (bottom left corner of every menu screen) to switch the mock API between scenarios. The choice is remembered across reloads. **Reset data** brings everything back to the first visit: it clears your confirmed matches from the mock database, empties the pending queue and selects `healthy` again.

| Scenario | What happens |
| --- | --- |
| `healthy` | Everything works with a 150 to 450 ms delay |
| `empty` | Ranking and history return empty pages |
| `slow` | Every answer takes 2.5 s |
| `jitter` | Latency jumps between 0.1 and 2.5 s |
| `out-of-order` | Odd requests take 2.2 s and even ones 0.25 s, so answers overtake each other |
| `timeout` | Nothing answers before the 5 s client timeout |
| `offline` | Requests fail with a network error |
| `server-error` | Every endpoint answers 500 |
| `client-error` | Every endpoint answers 400 |
| `ranking-down` | Only the ranking fails, with 503 |
| `history-down` | Only the match history fails, with 503 |
| `register-timeout-after-commit` | Saving a match is stored on the server, but the answer arrives after the client gave up |
| `register-unavailable` | Saving fails with 503 until you switch back to `healthy` |

## Reproducing failures by hand

1. **Asset loading failure.** In DevTools, Network tab, block the request pattern `ships.json`, then press Play. The loading panel reports the failure. Unblock and press **Try again**; the retry uses a fresh URL so nothing cached from the broken attempt sticks.
2. **Pending registration survives a refresh.** Pick `register-unavailable`, finish a match (the fastest way is to let the enemies sink you), and the result screen says the match is not saved yet. Reload the page: it is still pending. Switch to `healthy` and it is sent on its own within seconds, or press **Retry now**.
3. **Timeout after commit without duplicates.** Pick `register-timeout-after-commit` and finish a match. After 5 seconds the client times out, then the automatic retry finds the record the server already stored. Match History shows the match exactly once.
4. **Late answers.** Pick `out-of-order`, open Ranking and page forward and back quickly. The page on screen always matches the page label.
5. **Pause without time drift.** Start a match, switch to another window or tab and come back. The battle is paused and the clock did not move; nothing resumes until you press **Resume**.

## Tests

`npm run test:e2e` builds the production bundle, serves it and runs 56 scenarios on desktop Chromium (1280 x 720) and on a Pixel 7 in landscape. Combat tests press the real game keys (or dispatch real pointer events on the touch buttons) and advance the simulation through a manual clock exposed by the test bridge, so the rules, collisions and rendering run exactly as in the game while the timing stays reproducible. Every test starts from a fresh browser context, and any unexpected console error fails the test.

| Brief item | Spec |
| --- | --- |
| 1. Options navigation, validation, persistence | `options.spec.ts` |
| 2. Asset loading, failure and retry | `assets.spec.ts` |
| 3. Start, movement, rotation, arena limits, island collision | `movement.spec.ts` |
| 4. Bow and broadside fire, damage, cooldown, score without duplicates | `combat.spec.ts` |
| 5. Chaser and Shooter behaviour, spawn interval | `enemies.spec.ts` |
| 6. End by time and by death, frozen simulation, clean restart | `match-end.spec.ts` |
| 7. Pause, focus loss, resume without timer drift | `pause.spec.ts` |
| 8. Result screen and persistence after refresh | `result.spec.ts` |
| 9. Abandoning a match, repeated navigation, touch controls | `navigation.spec.ts` |
| 10. Ranking and history queries, paging, loading, empty and error | `logbook.spec.ts` |
| 11. Registration, both tabs updated, pending record after refresh | `registration.spec.ts` |
| 12. Retry after timeout without duplicates, late answers | `resilience.spec.ts` |
| Visual regression of menu, arena and result | `visual.spec.ts` |

The HTML report lands in `reports/playwright/` and traces of failing tests in `test-results/`. Visual baselines are versioned in `tests/e2e/__screenshots__/`.

## Project layout

```
src/
  app/        routing, preferences, URL flags, the App shell
  api/        contracts, axios client, queries, pending outbox, player identity
  game/
    sim/      pure simulation: ships, weapons, enemies, projectiles, spawner
    world/    arena layout and collision shapes
    render/   PixiJS layers: arena, ships, projectiles, effects
    session/  lifecycle glue between React, Pixi, input and the simulation
    input/    keyboard and the shared control pad
    audio/    Web Audio sound board
    assets/   spritesheet loading and validation
    testing/  the e2e bridge
  mocks/      MSW handlers, fixtures, mock database, scenarios, Network lab
  play/       the match screen, HUD and touch controls
  screens/    menu, options, result and captain's log
  ui/         buttons, panels and dialog
  styles/     plain CSS split by concern: tokens, base, layout, components,
              screens, network lab, play, and responsive overrides last
tests/e2e/    Playwright suite and visual baselines
tests/perf/   profiling run
```

## Credits and licenses

- Game art, UI atlases, reference screenshots and sounds in `assets/` were provided with the challenge by Jungle Gaming. `assets/optimized/menu_background.jpg` is a compressed copy of `ui_scene_background.png` (126 KB instead of 507 KB), used as the blurred menu backdrop. The ship and tile sheets follow the layout of Kenney's Pirate Pack, released under CC0 1.0.
- [Lilita One](https://fonts.google.com/specimen/Lilita+One) and [Nunito](https://fonts.google.com/specimen/Nunito), SIL Open Font License 1.1, bundled through Fontsource.
- PixiJS, React, TanStack Query, Axios and MSW are MIT licensed.
- The code in this repository was written for the challenge.
