# Third-party components

The simulation code in core/ is original project code under the repository MIT license. It does not embed Box2D or another physics engine.

- React and React DOM: MIT.
- Emscripten-generated JavaScript runtime: MIT / University of Illinois-NCSA terms; see the Emscripten SDK license.
- DM Sans and Space Grotesk fonts, distributed through Fontsource: SIL Open Font License 1.1.
- Vite, TypeScript, Playwright, and Prettier are build/test dependencies; their packages retain their licenses.

Pinned npm versions and transitive dependencies are recorded in web/package-lock.json. The generated engine is built with Emscripten 6.0.10. Preserve dependency license notices when redistributing a bundled application.
