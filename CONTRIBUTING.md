# Contributing

Start with the README and architecture document. Keep a change focused on an observable behavior, explain its tradeoffs, and run the relevant tests before opening a pull request.

Use commit subjects that describe the implementation or fix, such as `fix: preserve gravity when restoring a saved scene`. Do not claim performance or scale without a reproducible workload and recorded environment.

Run the frontend production build and browser suite. For engine changes, rebuild and test WASM plus native C++; for search changes, run Maven and Python tests. See the README for commands.

Format TypeScript/CSS with `npm run format` in web/. Kinetic C++ follows .clang-format; Folio Java uses the Prettier Java plugin installed in web/.

Do not commit credentials, personal documents, local indexes, temporary files, virtual environments, or build directories. Kinetic deliberately tracks its generated WASM runtime so the demo can run without a compiler.

Please report bugs with reproduction steps, browser/OS, expected behavior, and actual behavior. Use synthetic documents or scenes when sharing a reproduction.
