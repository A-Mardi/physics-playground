# Architecture notes

## Current scaffold

The web application displays project status and planned milestones. A C++ library and native executable report the scaffold version. There are no image-processing or simulation APIs yet.

## Intended responsibilities

A custom C++ library will own simulation state and physics. The browser will provide scene editing and rendering. Collision detection, simulation, and WebAssembly bindings are planned. The current native library only exposes its scaffold version.

## Development decisions

- Keep each component independently buildable.
- Add dependencies only when a concrete feature needs them.
- Keep long-running work out of the UI thread.
- Define cancellation and failure behavior alongside the main workflow.
- Measure performance before making optimization claims.
- Use existing libraries where appropriate and attribute their contribution.

These notes describe an initial direction. Record significant changes here as the implementation develops.
