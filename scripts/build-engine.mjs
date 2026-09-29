import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const sdk = process.env.EMSDK || resolve(root, '../.tools/emsdk');
const compiler =
  process.env.EMXX ||
  (existsSync(resolve(sdk, 'upstream/emscripten/em++.py'))
    ? resolve(sdk, 'upstream/emscripten/em++.py')
    : 'em++');
mkdirSync(resolve(root, 'web/public/engine'), { recursive: true });
const exports = [
  'world_reset',
  'body_add',
  'body_remove',
  'body_move',
  'body_velocity',
  'body_pick',
  'world_gravity',
  'world_material',
  'world_step',
  'world_count',
  'world_contacts',
  'world_candidates',
  'world_data',
];
const args = [
  'core/src/physics.cpp',
  '-Icore/include',
  '-std=c++20',
  '-O3',
  '--no-entry',
  '-sMODULARIZE=1',
  '-sEXPORT_ES6=1',
  '-sENVIRONMENT=web,worker,node',
  '-sINITIAL_MEMORY=33554432',
  '-sALLOW_MEMORY_GROWTH=0',
  '-sEXPORTED_RUNTIME_METHODS=HEAPF32',
  `-sEXPORTED_FUNCTIONS=${exports.map((x) => '_' + x).join(',')}`,
  '-o',
  'web/public/engine/physics.js',
];
let command = compiler;
if (compiler.endsWith('.py')) {
  command =
    process.env.EMSDK_PYTHON ||
    (process.platform === 'win32' ? resolve(sdk, 'python/3.13.3_64bit/python.exe') : 'python3');
  args.unshift(compiler);
}
const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
if (result.error)
  console.error(
    'Install Emscripten and activate its environment, or set EMSDK.\n' + result.error.message,
  );
process.exit(result.status ?? 1);
