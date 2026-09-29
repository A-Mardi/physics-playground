# Physics Playground

Build a scene, change the rules, and watch it move.

[![Build](https://github.com/A-Mardi/physics-playground/actions/workflows/build.yml/badge.svg)](https://github.com/A-Mardi/physics-playground/actions/workflows/build.yml)

**Status: initial scaffold.** This repository contains a runnable frontend and language-specific starter code. The product features described in the roadmap are not implemented. There are no performance or adoption claims yet.

## Stack

C++20, React, TypeScript; WebAssembly planned.

## Run the frontend

Requires Node.js 22.12+; CI uses Node.js 24. From the repository root:

```sh
cd web
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Each project uses the same development ports; run one project at a time or adjust `web/vite.config.js` and the service address.

`npm run check` checks TypeScript. `npm run build` checks types and creates a production frontend build. `npm run preview` serves that static build; it does not include an API proxy or backend.

## Run the native core

Install CMake 3.20+ and a C++20 compiler. From the repository root:

```sh
cmake -S core -B core/build -DCMAKE_BUILD_TYPE=Release
cmake --build core/build --config Release --parallel
```

Run `core/build/core-info` (single-configuration generators) or `core/build/Release/core-info.exe` (Visual Studio). It prints the library version and scaffold status. The C++ core is not yet connected to the frontend; WebAssembly integration is a future milestone.

## Repository layout

- `web/` — React + TypeScript frontend
- `core/` — C++20 library and native diagnostic executable
- `docs/` — scope, component boundaries, and implementation milestones
- `.github/workflows/build.yml` — frontend and language-specific build checks

## Development

Read [the roadmap](docs/ROADMAP.md), [architecture notes](docs/ARCHITECTURE.md), and [contribution guidance](CONTRIBUTING.md).

## License

[MIT](LICENSE).
