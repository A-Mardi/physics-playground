# Roadmap

## Shipped in 0.1.0 beta

Custom circle/box engine, WASM build, five presets, scene editing, live measurements, fixed-step playback, persistence, JSON import/export, native/WASM/browser tests.

## Next useful improvements

1. Replace approximate box contact points with face clipping; add adversarial stack/contact tests.
2. Add continuous collision tests for fast small bodies and a tunneling demonstration.
3. Add thumbnail previews to exported scene files.
4. Profile dense piles and low-power devices before introducing workers or sleeping bodies.
5. Improve keyboard-only scene manipulation and provide a text description of scene contents.

The canvas currently requires a pointer for placement and dragging. Responsive layout does not imply complete nonvisual accessibility.

## Added after the initial beta

Bounded scene-edit undo/redo, environment/velocity restoration, keyboard shortcuts, and a mobile toolbar layout. Browser tests check restored state and redo invalidation.
