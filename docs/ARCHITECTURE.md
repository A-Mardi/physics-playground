# Architecture

## One world, two execution rates

```text
React controls → C ABI → C++ world in WASM memory
                         ↓ fixed 1/120 s steps
                    integrate velocities
                         ↓
                 grid candidate generation
                         ↓
              circle / oriented-box contacts
                         ↓
              ten velocity-solver iterations
                         ↓
                 penetration correction
                         ↓
packed Float32 state → Canvas 2D at requestAnimationFrame rate
```

The engine owns simulation state. React owns UI state; the render loop uses refs so pointer movement and physics do not trigger component updates every frame. Telemetry updates approximately every 400 ms.

## Collision pipeline

A 28 × 18 grid with 50-pixel cells indexes each body's axis-aligned bounds. A fixed-size pair table removes duplicates when two bodies share multiple cells. Static-static pairs are skipped. This reduces work in dispersed scenes; it does not make a dense cluster subquadratic.

Circle-circle and circle-box contacts use direct geometry. Box-box detection tests four separating axes. Contact points come from overlapping vertices; a midpoint fallback handles configurations without contained vertices. This compact manifold is a deliberate beta limitation: it is less robust than clipped reference/incident faces.

Semi-implicit Euler advances velocity and position. Impulses account for inverse mass, rotational inertia, restitution, and tangential friction. A separate positional correction resolves penetration with a small slop allowance. Damping and speed caps favor an explorable sandbox over exact energy conservation.

## ABI and memory

`core/include/physics.hpp` is the public boundary. No C++ objects cross it. Each body occupies 12 floats in the presentation buffer: ID, shape, x, y, width, height, angle, vx, vy, static flag, angular velocity, reserved. IDs 0–3 are world boundaries.

The module reserves 32 MiB of linear memory. Memory growth is disabled, which keeps the typed-array view stable. The client copies body records for rendering. The capacity is 512 total bodies.

## Time and overload

A fixed-step accumulator decouples physics from display refresh. Frame deltas are capped at 66 ms and catch-up at 12 steps. Excess accumulated time is dropped under sustained overload; simulated time can therefore lag wall-clock time. Changing playback speed changes accumulated simulation time, not solver step size.

## Persistence

Versioned JSON contains material settings and body state. Import validates dimensions, counts, and finite numeric values before resetting the world. Restoring applies environment values directly to the engine even when React state has not changed. Imported scenes start paused.

## Decisions

- **C++ / WASM:** a small explicit systems boundary, native testability, and the same engine in tests and the browser.
- **Canvas 2D:** sufficient for a 2D sandbox without the complexity of a 3D renderer.
- **Main-thread simulation:** simpler ownership and debugging at the current scale. A worker and transferable snapshots become worthwhile only after profiling demonstrates frame contention.
- **Checked-in generated engine:** a fresh clone runs with Node alone. CI rebuilds from source before validating.
