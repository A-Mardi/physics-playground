import createPhysics from './physics.js';

// Load the generated module as a static asset, outside Vite's source transforms.
window.physicsReady = createPhysics({
  locateFile: (file) => new URL(file, import.meta.url).href,
});
