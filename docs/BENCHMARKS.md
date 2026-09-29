# Engine measurements

Run `node scripts/test-engine.mjs` after rebuilding the engine. The script checks gravity, floor contact, equal-disk collision response, static obstacles, finite state, and broadphase pruning before reporting timing.

## Recorded beta run

September 29, 2026; Windows; Intel Core Ultra 7 155H; Node v24.19.0; Emscripten 6.0.10; optimized WASM build (`-O3`).

| Workload | Result |
| --- | ---: |
| Dynamic bodies | 240 |
| Additional world boundaries | 4 |
| Simulation steps | 600 at 1/120 s |
| Total simulation time on CPU | 103.26 ms |
| Mean CPU time per step | 0.172 ms |
| Candidate pairs on the final step | 1,645 |
| All possible pairs among 244 bodies | 29,646 |

The scene starts with alternating 24-pixel circles and boxes in a regular grid, then falls under gravity. Timing covers only calls to `world_step` in Node; it excludes rendering, React, startup, and copying the presentation buffer. Earlier invariant checks warm the module, but there is no controlled JIT warm-up for the exact stress workload.

This is one run on one machine, not a percentile study or a maximum-capacity claim. Pair counts include static boundaries; the all-pairs baseline also includes static-static pairs that an ordinary brute-force implementation could skip. Do not generalize this result to dense stacks or all devices.

The browser overlay separately reports actual render FPS and mean physics-step time over a short sampling window. Paused simulation reports zero step time.
