export interface Engine {
  HEAPF32: Float32Array;
  _world_reset(): void;
  _body_add(
    shape: number,
    x: number,
    y: number,
    w: number,
    h: number,
    angle: number,
    fixed: number,
  ): number;
  _body_remove(id: number): void;
  _body_move(id: number, x: number, y: number, angle: number): void;
  _body_velocity(id: number, vx: number, vy: number, angular: number): void;
  _body_pick(x: number, y: number): number;
  _world_gravity(x: number, y: number): void;
  _world_material(bounce: number, friction: number): void;
  _world_step(dt: number): void;
  _world_count(): number;
  _world_contacts(): number;
  _world_candidates(): number;
  _world_data(): number;
}
export type Body = {
  id: number;
  shape: number;
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  vx: number;
  vy: number;
  fixed: number;
  angular: number;
};
export const WIDTH = 1400,
  HEIGHT = 880;
export function readBodies(e: Engine): Body[] {
  const start = e._world_data() / 4,
    heap = e.HEAPF32;
  return Array.from({ length: e._world_count() }, (_, i) => {
    const p = start + i * 12;
    return {
      id: heap[p],
      shape: heap[p + 1],
      x: heap[p + 2],
      y: heap[p + 3],
      w: heap[p + 4],
      h: heap[p + 5],
      angle: heap[p + 6],
      vx: heap[p + 7],
      vy: heap[p + 8],
      fixed: heap[p + 9],
      angular: heap[p + 10],
    };
  });
}
export const presets = [
  {
    id: 'garden',
    name: 'Gravity garden',
    description: 'A little controlled chaos',
    count: 'Mixed bodies',
  },
  {
    id: 'domino',
    name: 'Chain reaction',
    description: 'One nudge changes everything',
    count: 'Domino experiment',
  },
  { id: 'stack', name: 'Stack attack', description: 'Balance, then break it', count: '36 boxes' },
  {
    id: 'rain',
    name: 'Particle rain',
    description: 'Put the broadphase to work',
    count: '160 circles',
  },
  {
    id: 'empty',
    name: 'Blank canvas',
    description: 'Make your own experiment',
    count: 'Start fresh',
  },
];
export function preset(e: Engine, id: string) {
  e._world_reset();
  const add = (shape: number, x: number, y: number, w: number, h = w, angle = 0, fixed = 0) =>
    e._body_add(shape, x, y, w, h, angle, fixed);
  if (id === 'garden') {
    add(1, 380, 300, 350, 20, 0.18, 1);
    add(1, 980, 490, 370, 20, -0.2, 1);
    for (let i = 0; i < 18; i++)
      add(
        i % 3 === 0 ? 1 : 0,
        240 + (i % 6) * 75,
        65 + Math.floor(i / 6) * 66,
        38 + (i % 3) * 8,
        40,
        i * 0.13,
      );
    for (let i = 0; i < 5; i++) add(1, 670, 800 - i * 49, 46, 46);
    add(0, 1100, 100, 90);
    add(0, 900, 140, 58);
  } else if (id === 'domino') {
    for (let i = 0; i < 22; i++) add(1, 350 + i * 37, 800, 14, 78);
    const ball = add(0, 160, 785, 55);
    e._body_velocity(ball, 450, 0, 0);
  } else if (id === 'stack') {
    for (let row = 0; row < 8; row++)
      for (let j = 0; j < 8 - row; j++) add(1, 505 + row * 24 + j * 48, 816 - row * 49, 45, 45);
    add(0, 200, 600, 70);
  } else if (id === 'rain') {
    for (let i = 0; i < 160; i++)
      add(0, 100 + (i % 25) * 49, 55 + Math.floor(i / 25) * 65, 20 + (i % 5) * 3);
  }
}
export async function loadEngine(): Promise<Engine> {
  const host = window as Window & { physicsReady?: Promise<Engine> };
  for (let i = 0; i < 100 && !host.physicsReady; i++)
    await new Promise((resolve) => setTimeout(resolve, 25));
  if (!host.physicsReady)
    throw new Error('Engine loader is unavailable. Rebuild the WebAssembly module.');
  return host.physicsReady;
}
