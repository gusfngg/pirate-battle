# Performance

The target was a steady 60 FPS during combat on the reference machine, with no resource growth from match to match. Both hold. The raw numbers live in [`docs/perf/`](docs/perf) and every figure below can be reproduced with `npm run perf`.

## Reference environment

| | |
| --- | --- |
| Hardware | Apple M4 (10 cores), 16 GB RAM |
| OS | macOS 27.0 |
| Browser | Chromium 153 (Playwright), GPU enabled: ANGLE Metal renderer on the Apple M4 |
| Viewport | 1600 x 900 CSS pixels at devicePixelRatio 2, so the canvas renders at the 2x cap |
| Build | `npm run build`, served by `vite preview` |
| Display cap | `requestAnimationFrame` runs at 60 Hz in this setup |

## How it is measured

`tests/perf/perf.spec.ts` opens the production build in test mode on the **real clock** (`?e2e=1&clock=real`), so the fixed step loop runs exactly as for a player. An autopilot holds the throttle, alternates turns every three seconds, keeps the bow cannon firing and fires a broadside every second. That keeps projectiles, hits, explosions, debris and wakes on screen for the whole run. Frame times come from a `requestAnimationFrame` loop in the page (the first 30 frames are dropped as warm up). Entity counts are sampled once per second from the renderer.

The player's health is refilled once per second. Without it the autopilot sinks in about 20 seconds and the run would measure an empty sea instead of a battle.

## Three minute match

Setup: 180 second session, 3 second spawn interval, seed 11 (`docs/perf/match-180s-spawn3s.json`).

| Metric | Value |
| --- | --- |
| Measured time | 176 s (the autopilot stops a few seconds before the clock so the page is still in the match) |
| Frames | 10 531 |
| Average frame rate | **60.0 FPS** |
| Frame time p50 / p95 / p99 | 16.7 / **16.7** / 16.8 ms |
| Worst frame | 16.8 ms |
| Frames slower than 20 ms | 0 |
| Enemies spawned | 36 Chasers, 23 Shooters |
| Ships on screen | peak 8, average 5.4 |
| Cannon balls in flight | peak 5, average 1.3 |
| Live effects (flashes, smoke, splashes, debris, wrecks) | peak 35, average 10.4 |

## Stress: fastest spawn

Setup: 60 seconds with the minimum 1 second spawn interval, which keeps the arena at the 10 enemy cap (`docs/perf/match-60s-spawn1s.json`).

| Metric | Value |
| --- | --- |
| Average frame rate | **60.0 FPS** |
| Frame time p95 / worst | 16.7 / 16.8 ms |
| Frames slower than 20 ms | 0 |
| Ships on screen | peak 11, average 9.4 |
| Live effects | peak 36, average 16.3 |

## Memory across start, play and leave cycles

Each cycle presses Play, runs the autopilot, pauses, returns to the main menu and measures after two forced garbage collections (Chrome DevTools Protocol `HeapProfiler.collectGarbage` plus `Performance.getMetrics`).

**Five cycles of 20 seconds** (`docs/perf/memory-5-cycles.json`):

| Reading | JS heap | DOM nodes | Event listeners | Canvases |
| --- | --- | --- | --- | --- |
| Menu, before any match | 4.69 MB | 133 | 183 | 0 |
| In match, cycles 1 to 5 | 8.74 to 9.90 MB | 141 | 228 | 1 |
| Menu after cycle 1 | 7.76 MB | 137 | 197 | 0 |
| Menu after cycle 5 | 8.56 MB | 137 | 197 | 0 |

The first match loads PixiJS, the textures and the audio buffers, which stay alive on purpose so later matches start instantly. After that, DOM nodes, listeners and canvases return to exactly the same numbers every time. That confirms the ticker, keyboard, blur, visibility and resize listeners, the Pixi application and its canvas are all released.

The heap still rose by 0.8 MB over cycles 2 to 5, so I ran **fifteen shorter cycles** (`docs/perf/memory-15-cycles.json`) to see where that goes. The menu readings were:

`7.49, 7.84, 8.04, 8.18, 8.35, 8.42, 8.45, 8.50, 8.84, 8.89, 8.92, 8.94, 8.96, 9.00, 9.02 MB`

The steps shrink from 0.35 MB to about 0.02 MB per cycle and flatten out around 9 MB. That shape is warm up: V8 compiling and keeping optimized code for paths that only run inside a match, and PixiJS filling its internal object pools. A leak would add a similar amount on every cycle. Listener and DOM growth stayed at zero across all fifteen cycles.

## What keeps it cheap

- The static ground (shallows, 61 island tiles, decor, rocks) is baked once into a single texture with `cacheAsTexture`.
- Every sprite comes from three atlases, so the scene draws in a handful of batches. Health bars crop a sub-texture instead of using masks, which would break batching.
- Cannon ball sprites are pooled. Trails and wakes are two `Graphics` objects redrawn per frame instead of one object per trail or foam dot.
- React never renders per frame. The HUD store only publishes whole second, score, health and phase changes.
- The simulation runs at a fixed 60 Hz with a 250 ms clamp, so a slow frame cannot trigger a spiral of catch up steps.
- PixiJS is split into its own chunk, loaded when the first match starts, so the menus load without it.

## Limitations

- These numbers come from one machine with a strong GPU. The frame rate is capped by the 60 Hz `requestAnimationFrame`, so they show that the game holds the target, not how much headroom is left. A weaker laptop or phone will have less margin. The largest costs to watch there are the 2x canvas resolution on dense screens and the per frame redraw of wakes.
- Headless Chromium without GPU flags falls back to software WebGL (SwiftShader). The e2e suite runs that way and is fine for correctness, but its frame rate is not representative, which is why the profiler forces the Metal backend.
- The autopilot is deliberately simple. It keeps combat busy but does not play well (20 points in three minutes), so the scene is lighter than an expert run with more simultaneous broadsides.
- Memory is read through Chrome's JS heap metric. GPU memory is not measured directly. Textures are loaded once and never duplicated, and the canvas count returning to zero shows each WebGL context is released.
