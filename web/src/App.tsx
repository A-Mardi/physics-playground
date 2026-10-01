import { useEffect, useRef, useState } from 'react';
import { loadEngine, readBodies, preset, presets, WIDTH, HEIGHT } from './engine';
import type { Body, Engine } from './engine';

type Tool = 'select' | 'circle' | 'box' | 'platform' | 'erase';
const tools: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'circle', label: 'Circle' },
  { id: 'box', label: 'Box' },
  { id: 'platform', label: 'Platform' },
  { id: 'erase', label: 'Erase' },
];
const initialMetrics = { fps: 0, step: 0, count: 0, contacts: 0, candidates: 0 };
type SceneSnapshot = {
  gravity: number;
  bounce: number;
  friction: number;
  scene: string;
  bodies: Body[];
};

function ToolIcon({ tool }: { tool: Tool }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {tool === 'select' && <path d="m4 3 12 7-6 1-3 6z" />}
      {tool === 'circle' && <circle cx="10" cy="10" r="6.5" />}
      {tool === 'box' && <rect x="4" y="4" width="12" height="12" rx="1" />}
      {tool === 'platform' && <path d="m3 15 14-10M4 17l1-3m3 1 1-3m3 1 1-3m3 1 1-3" />}
      {tool === 'erase' && <path d="m3 12 8-8 6 6-7 7H8zM7 8l6 6M10 17h7" />}
    </svg>
  );
}

export default function App() {
  const engine = useRef<Engine | null>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<'settings' | 'scene' | null>(null);
  const panelAnchor = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const sceneButton = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [running, setRunning] = useState(true),
    [scene, setScene] = useState('garden');
  const [tool, setTool] = useState<Tool>('select'),
    [gravity, setGravity] = useState(760),
    [bounce, setBounce] = useState(0.2),
    [friction, setFriction] = useState(0.45),
    [speed, setSpeed] = useState(1),
    [size, setSize] = useState(44),
    [debug, setDebug] = useState(false);
  const [metrics, setMetrics] = useState(initialMetrics),
    [selected, setSelected] = useState<Body | null>(null),
    [notice, setNotice] = useState('Drag a shape to move it.');
  const live = useRef({ running, tool, speed, debug, size, selected: -1 });
  live.current = { running, tool, speed, debug, size, selected: selected?.id ?? -1 };
  const drag = useRef<{
    id: number;
    dx: number;
    dy: number;
    angle: number;
    before: SceneSnapshot;
    recorded: boolean;
  } | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const edits = useRef<{ past: SceneSnapshot[]; future: SceneSnapshot[] }>({
    past: [],
    future: [],
  });
  const [, setHistoryRevision] = useState(0);
  const environment = useRef({ gravity, bounce, friction, scene });
  environment.current = { gravity, bounce, friction, scene };
  function snapshot(): SceneSnapshot {
    return {
      ...environment.current,
      bodies: engine.current ? readBodies(engine.current).filter((b) => b.id >= 4) : [],
    };
  }
  function remember(before = snapshot()) {
    if (!engine.current) return;
    edits.current.past.push(before);
    if (edits.current.past.length > 50) edits.current.past.shift();
    edits.current.future = [];
    setHistoryRevision((n) => n + 1);
  }
  function travel(direction: 'past' | 'future') {
    const e = engine.current,
      entry = edits.current[direction].pop();
    if (!e || !entry) return;
    edits.current[direction === 'past' ? 'future' : 'past'].push(snapshot());
    drag.current = null;
    live.current.running = false;
    setRunning(false);
    e._world_reset();
    for (const body of entry.bodies) {
      const id = e._body_add(body.shape, body.x, body.y, body.w, body.h, body.angle, body.fixed);
      e._body_velocity(id, body.vx, body.vy, body.angular);
    }
    e._world_gravity(0, entry.gravity);
    e._world_material(entry.bounce, entry.friction);
    setGravity(entry.gravity);
    setBounce(entry.bounce);
    setFriction(entry.friction);
    setScene(entry.scene);
    environment.current = entry;
    setSelected(null);
    setMetrics((m) => ({ ...m, count: entry.bodies.length }));
    setHistoryRevision((n) => n + 1);
    setNotice((direction === 'past' ? 'Edit undone.' : 'Edit redone.') + ' Scene paused.');
  }

  useEffect(() => {
    if (!panel) return;
    const close = (event: PointerEvent) => {
      if (!panelAnchor.current?.contains(event.target as Node)) setPanel(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(null);
        (panel === 'settings' ? settingsButton : sceneButton).current?.focus();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', escape);
    };
  }, [panel]);

  useEffect(() => {
    let disposed = false,
      frame = 0,
      last = 0,
      accumulator = 0,
      frames = 0,
      measureStart = 0,
      stepTotal = 0,
      stepCount = 0;
    loadEngine()
      .then((e) => {
        if (disposed) return;
        engine.current = e;
        preset(e, 'garden');
        setReady(true);
        const draw = (now: number) => {
          if (disposed) return;
          const dt = last ? Math.min((now - last) / 1000, 0.066) : 0;
          last = now;
          if (live.current.running) {
            accumulator += dt * live.current.speed;
            let iterations = 0;
            while (accumulator >= 1 / 120 && iterations < 12) {
              const start = performance.now();
              e._world_step(1 / 120);
              stepTotal += performance.now() - start;
              stepCount++;
              accumulator -= 1 / 120;
              iterations++;
            }
            if (iterations === 12) accumulator = 0;
          } else accumulator = 0;
          const element = canvas.current,
            ctx = element?.getContext('2d');
          const bodies = readBodies(e);
          if (element && ctx) {
            const rect = element.getBoundingClientRect(),
              dpr = Math.min(devicePixelRatio || 1, 2);
            const w = Math.round(rect.width * dpr),
              h = Math.round(rect.height * dpr);
            if (element.width !== w || element.height !== h) {
              element.width = w;
              element.height = h;
            }
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            const scale = Math.min(w / WIDTH, h / HEIGHT),
              ox = (w - WIDTH * scale) / 2,
              oy = (h - HEIGHT * scale) / 2;
            ctx.setTransform(scale, 0, 0, scale, ox, oy);
            ctx.fillStyle = '#f7f7f2';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = '#263c3206';
            ctx.fillRect(0, 840, WIDTH, 40);
            ctx.strokeStyle = '#263c321c';
            ctx.beginPath();
            ctx.moveTo(0, 840);
            ctx.lineTo(WIDTH, 840);
            ctx.stroke();
            for (const b of bodies) {
              if (b.id < 4) continue;
              ctx.save();
              ctx.translate(b.x, b.y);
              ctx.rotate(b.angle);
              ctx.fillStyle = b.fixed ? '#263c32' : '#9fbaa8';
              ctx.strokeStyle = b.id === live.current.selected ? '#263c32' : '#263c3210';
              ctx.lineWidth = b.id === live.current.selected ? 3 : 1.5;
              ctx.beginPath();
              if (b.shape === 0) ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
              else ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, Math.min(4, b.h / 4));
              ctx.fill();
              ctx.stroke();
              if (b.shape === 0) {
                ctx.strokeStyle = '#263c3244';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(b.w * 0.16, 0);
                ctx.lineTo(b.w * 0.34, 0);
                ctx.stroke();
              }
              if (b.fixed) {
                ctx.strokeStyle = '#f7f7f240';
                ctx.lineWidth = 1;
                for (let x = -b.w / 2 + 10; x < b.w / 2; x += 16) {
                  ctx.beginPath();
                  ctx.moveTo(x, -b.h / 2 + 3);
                  ctx.lineTo(x - 6, b.h / 2 - 3);
                  ctx.stroke();
                }
              }
              ctx.restore();
              if (live.current.debug && !b.fixed) {
                ctx.strokeStyle = '#263c32';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(b.x, b.y);
                ctx.lineTo(b.x + b.vx * 0.15, b.y + b.vy * 0.15);
                ctx.stroke();
              }
            }
            if (
              pointer.current &&
              live.current.tool !== 'select' &&
              live.current.tool !== 'erase'
            ) {
              const { x, y } = pointer.current;
              ctx.strokeStyle = '#263c32';
              ctx.setLineDash([5, 5]);
              ctx.lineWidth = 2;
              ctx.beginPath();
              if (live.current.tool === 'circle')
                ctx.arc(x, y, live.current.size / 2, 0, Math.PI * 2);
              else
                ctx.rect(
                  x - (live.current.tool === 'platform' ? 100 : live.current.size / 2),
                  y - (live.current.tool === 'platform' ? 9 : live.current.size / 2),
                  live.current.tool === 'platform' ? 200 : live.current.size,
                  live.current.tool === 'platform' ? 18 : live.current.size,
                );
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }
          frames++;
          if (now - measureStart > 400) {
            setMetrics({
              fps: Math.round((frames * 1000) / (now - measureStart)),
              step: stepCount ? stepTotal / stepCount : 0,
              count: bodies.length - 4,
              contacts: e._world_contacts(),
              candidates: e._world_candidates(),
            });
            if (live.current.selected >= 0)
              setSelected(bodies.find((b) => b.id === live.current.selected) ?? null);
            frames = 0;
            stepTotal = 0;
            stepCount = 0;
            measureStart = now;
          }
          frame = requestAnimationFrame(draw);
        };
        frame = requestAnimationFrame(draw);
      })
      .catch((reason) => setError('The C++ engine could not load. ' + String(reason)));
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    engine.current?._world_gravity(0, gravity);
  }, [gravity, ready]);
  useEffect(() => {
    engine.current?._world_material(bounce, friction);
  }, [bounce, friction, ready]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).matches('input,select,textarea')) return;
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        travel(event.shiftKey || event.key.toLowerCase() === 'y' ? 'future' : 'past');
        return;
      }
      if ((event.target as HTMLElement).matches('button')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setRunning((v) => !v);
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (live.current.selected >= 0) {
          event.preventDefault();
          remember();
          engine.current?._body_remove(live.current.selected);
          setSelected(null);
        }
      }
      const index = Number(event.key) - 1;
      if (index >= 0 && index < tools.length) setTool(tools[index].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  function loadScene(id: string) {
    if (!engine.current) return;
    remember();
    preset(engine.current, id);
    engine.current._world_gravity(0, gravity);
    engine.current._world_material(bounce, friction);
    setScene(id);
    setSelected(null);
    setRunning(true);
    setNotice('Scene loaded. Make it your own.');
  }
  function coordinates(event: React.PointerEvent<HTMLCanvasElement>) {
    const r = event.currentTarget.getBoundingClientRect(),
      scale = Math.min(r.width / WIDTH, r.height / HEIGHT);
    return {
      x: (event.clientX - r.left - (r.width - WIDTH * scale) / 2) / scale,
      y: (event.clientY - r.top - (r.height - HEIGHT * scale) / 2) / scale,
    };
  }
  function down(event: React.PointerEvent<HTMLCanvasElement>) {
    const e = engine.current;
    if (!e) return;
    const p = coordinates(event);
    if (p.x < 0 || p.x > WIDTH || p.y < 0 || p.y > 840) return;
    if (tool === 'select' || tool === 'erase') {
      const id = e._body_pick(p.x, p.y);
      if (tool === 'erase') {
        if (id < 4) return;
        remember();
        e._body_remove(id);
        setSelected(null);
        return;
      }
      const b = readBodies(e).find((b) => b.id === id) ?? null;
      setSelected(b);
      if (b) {
        drag.current = {
          id,
          dx: b.x - p.x,
          dy: b.y - p.y,
          angle: b.angle,
          before: snapshot(),
          recorded: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } else {
      const before = snapshot();
      const id = e._body_add(
        tool === 'circle' ? 0 : 1,
        p.x,
        p.y,
        tool === 'platform' ? 200 : size,
        tool === 'platform' ? 18 : size,
        0,
        tool === 'platform' ? 1 : 0,
      );
      if (id < 0) setNotice('This scene has reached the 508-body limit.');
      else {
        remember(before);
        setSelected(readBodies(e).find((b) => b.id === id) ?? null);
        setNotice('Body added. Switch to Select to move it.');
      }
    }
  }
  function save(download = false) {
    const e = engine.current;
    if (!e) return;
    const value = {
      version: 1,
      gravity,
      bounce,
      friction,
      bodies: readBodies(e).filter((b) => b.id >= 4),
    };
    const json = JSON.stringify(value, null, 2);
    if (download) {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kinetic-scene.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Scene exported as JSON.');
    } else {
      try {
        localStorage.setItem('kinetic.scene.v1', json);
        setNotice('Scene saved on this device.');
      } catch {
        setNotice('Local storage is unavailable. Export a JSON file instead.');
      }
    }
  }
  function restore(text: string) {
    try {
      const value = JSON.parse(text);
      if (value.version !== 1 || !Array.isArray(value.bodies) || value.bodies.length > 508)
        throw Error('Unsupported scene format');
      if (![value.gravity, value.bounce, value.friction].every(Number.isFinite))
        throw Error('Invalid environment settings');
      for (const b of value.bodies) {
        if (
          ![b.x, b.y, b.w, b.h, b.angle, b.vx, b.vy, b.angular].every(Number.isFinite) ||
          ![0, 1].includes(b.shape) ||
          ![0, 1].includes(b.fixed) ||
          b.w < 8 ||
          b.w > 1400 ||
          b.h < 8 ||
          b.h > 880 ||
          b.x < 0 ||
          b.x > 1400 ||
          b.y < 0 ||
          b.y > 880
        )
          throw Error('Scene contains an invalid body');
      }
      const e = engine.current;
      if (!e) return;
      remember();
      e._world_reset();
      for (const b of value.bodies) {
        const id = e._body_add(b.shape, b.x, b.y, b.w, b.h, b.angle, b.fixed);
        e._body_velocity(id, b.vx, b.vy, b.angular);
      }
      const restoredGravity = Math.max(0, Math.min(1600, value.gravity)),
        restoredBounce = Math.max(0, Math.min(1, value.bounce)),
        restoredFriction = Math.max(0, Math.min(1, value.friction));
      // Reset changes engine settings even when React state already has these values.
      e._world_gravity(0, restoredGravity);
      e._world_material(restoredBounce, restoredFriction);
      setGravity(restoredGravity);
      setBounce(restoredBounce);
      setFriction(restoredFriction);
      setSelected(null);
      setScene('custom');
      setRunning(false);
      setNotice('Scene restored and paused. Press Play when ready.');
    } catch (reason) {
      setNotice('Could not load scene: ' + (reason as Error).message);
    }
  }
  return (
    <div className="app-shell" data-ready={ready}>
      <header className="topbar">
        <h1 className="brand">
          <span aria-hidden="true">◒</span> kinetic
        </h1>
        <select
          className="scene-select"
          aria-label="Scene"
          value={scene}
          onChange={(e) => loadScene(e.target.value)}
          disabled={!ready}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {scene === 'custom' && <option value="custom">Your experiment</option>}
        </select>
        <div className="panel-anchor" ref={panelAnchor}>
          <button
            ref={settingsButton}
            className="settings-trigger"
            aria-expanded={panel === 'settings'}
            aria-controls="settings-panel"
            onClick={() => setPanel(panel === 'settings' ? null : 'settings')}
            disabled={!ready}
          >
            Settings
          </button>
          <button
            ref={sceneButton}
            className="icon-button"
            aria-label="Scene options"
            aria-expanded={panel === 'scene'}
            aria-controls="scene-panel"
            onClick={() => setPanel(panel === 'scene' ? null : 'scene')}
            disabled={!ready}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {panel === 'scene' && (
            <section id="scene-panel" className="popover scene-menu" aria-label="Scene options">
              <button
                onClick={() => {
                  save();
                  setPanel(null);
                }}
              >
                Save scene <span>On this device</span>
              </button>
              <button
                onClick={() => {
                  try {
                    const saved = localStorage.getItem('kinetic.scene.v1');
                    if (saved) restore(saved);
                    else setNotice('No saved scene yet.');
                  } catch {
                    setNotice('Local storage is unavailable.');
                  }
                  setPanel(null);
                }}
              >
                Restore saved scene
              </button>
              <div className="menu-divider" />
              <button
                onClick={() => {
                  save(true);
                  setPanel(null);
                }}
              >
                Export JSON <span>↗</span>
              </button>
              <button
                onClick={() => {
                  input.current?.click();
                  setPanel(null);
                }}
              >
                Import JSON <span>↙</span>
              </button>
              <div className="menu-divider" />
              <a
                href="https://github.com/A-Mardi/physics-playground"
                target="_blank"
                rel="noreferrer"
              >
                View source <span>↗</span>
              </a>
            </section>
          )}
          {panel === 'settings' && (
            <section
              id="settings-panel"
              className="popover settings-panel"
              aria-label="World settings"
            >
              <div className="panel-heading">
                <h2>Settings</h2>
                <button
                  className="icon-button"
                  aria-label="Close settings"
                  onClick={() => {
                    setPanel(null);
                    settingsButton.current?.focus();
                  }}
                >
                  ×
                </button>
              </div>
              <label>
                Gravity <output>{gravity} px/s²</output>
                <input
                  aria-label="Gravity"
                  type="range"
                  min="0"
                  max="1600"
                  step="20"
                  value={gravity}
                  onChange={(e) => {
                    remember();
                    setGravity(+e.target.value);
                  }}
                />
              </label>
              <label>
                Bounce <output>{Math.round(bounce * 100)}%</output>
                <input
                  aria-label="Bounce"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={bounce}
                  onChange={(e) => {
                    remember();
                    setBounce(+e.target.value);
                  }}
                />
              </label>
              <label>
                Friction <output>{Math.round(friction * 100)}%</output>
                <input
                  aria-label="Friction"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={friction}
                  onChange={(e) => {
                    remember();
                    setFriction(+e.target.value);
                  }}
                />
              </label>
              <label>
                New body size <output>{size} px</output>
                <input
                  aria-label="Body size"
                  type="range"
                  min="16"
                  max="110"
                  step="2"
                  value={size}
                  onChange={(e) => setSize(+e.target.value)}
                />
              </label>
              <label className="inline-label">
                Speed{' '}
                <select
                  aria-label="Simulation speed"
                  value={speed}
                  onChange={(e) => setSpeed(+e.target.value)}
                >
                  <option value=".25">0.25×</option>
                  <option value=".5">0.5×</option>
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                </select>
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={debug}
                  onChange={(e) => setDebug(e.target.checked)}
                />{' '}
                Velocity vectors
              </label>
              {selected && (
                <details className="detail-section" open>
                  <summary>
                    Selected {selected.fixed ? 'platform' : selected.shape === 0 ? 'circle' : 'box'}
                  </summary>
                  <dl>
                    <dt>Position</dt>
                    <dd>
                      {Math.round(selected.x)}, {Math.round(selected.y)}
                    </dd>
                    <dt>Speed</dt>
                    <dd>{Math.round(Math.hypot(selected.vx, selected.vy))} px/s</dd>
                  </dl>
                  <label>
                    Rotation <output>{Math.round((selected.angle * 180) / Math.PI)}°</output>
                    <input
                      aria-label="Body rotation"
                      type="range"
                      min="-180"
                      max="180"
                      value={Math.round((selected.angle * 180) / Math.PI)}
                      onChange={(event) => {
                        remember();
                        engine.current?._body_move(
                          selected.id,
                          selected.x,
                          selected.y,
                          (+event.target.value * Math.PI) / 180,
                        );
                        setSelected({ ...selected, angle: (+event.target.value * Math.PI) / 180 });
                      }}
                    />
                  </label>
                  <button
                    className="remove-button"
                    onClick={() => {
                      remember();
                      engine.current?._body_remove(selected.id);
                      setSelected(null);
                    }}
                  >
                    Remove body
                  </button>
                </details>
              )}
              <details className="detail-section">
                <summary>Performance</summary>
                <dl>
                  <dt>Render rate</dt>
                  <dd>{metrics.fps} fps</dd>
                  <dt>Mean physics step</dt>
                  <dd>{metrics.step.toFixed(2)} ms</dd>
                  <dt>Contact pairs</dt>
                  <dd>{metrics.contacts}</dd>
                  <dt>Candidate pairs</dt>
                  <dd>{metrics.candidates}</dd>
                </dl>
                <p>120 Hz fixed step · C++ / WebAssembly</p>
              </details>
            </section>
          )}
        </div>
      </header>
      <input
        ref={input}
        type="file"
        accept=".json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 500000) setNotice('Scene file is too large.');
            else restore(await f.text());
          }
          e.target.value = '';
        }}
      />
      <main className="stage" aria-label="Physics playground">
        {error ? (
          <div className="engine-error" role="alert">
            {error}
          </div>
        ) : (
          <canvas
            ref={canvas}
            aria-label="Interactive physics scene. Choose a shape, then click to add it. Select and drag existing bodies."
            onPointerDown={down}
            onPointerMove={(event) => {
              const p = coordinates(event);
              pointer.current = p;
              const d = drag.current;
              if (d) {
                if (!d.recorded) {
                  remember(d.before);
                  d.recorded = true;
                }
                engine.current?._body_move(d.id, p.x + d.dx, p.y + d.dy, d.angle);
              }
            }}
            onPointerUp={(event) => {
              drag.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onPointerLeave={() => {
              pointer.current = null;
            }}
          />
        )}
        {!ready && !error && (
          <div className="loading-note" role="status">
            Loading playground…
          </div>
        )}
      </main>
      <nav className="toolbar" aria-label="Playground controls">
        <div className="tool-group" aria-label="Scene tools">
          {tools.map((t, i) => (
            <button
              key={t.id}
              aria-label={t.label}
              aria-pressed={tool === t.id}
              className={'tool-button ' + (tool === t.id ? 'chosen' : '')}
              onClick={() => setTool(t.id)}
              title={t.label + ' (' + (i + 1) + ')'}
              disabled={!ready}
            >
              <ToolIcon tool={t.id} />
              <span className="tool-tip">{t.label}</span>
            </button>
          ))}
        </div>
        <span className="toolbar-divider" />
        <div className="transport">
          <button
            className="tool-button"
            aria-label="Undo edit"
            title="Undo edit (Ctrl/⌘ Z)"
            disabled={!edits.current.past.length}
            onClick={() => travel('past')}
          >
            ↶
          </button>
          <button
            className="tool-button"
            aria-label="Redo edit"
            title="Redo edit (Ctrl/⌘ Shift Z)"
            disabled={!edits.current.future.length}
            onClick={() => travel('future')}
          >
            ↷
          </button>
        </div>
        <span className="toolbar-divider" />
        <div className="transport">
          <button
            className="play-button"
            aria-label={running ? 'Pause' : 'Play'}
            title={running ? 'Pause (Space)' : 'Play (Space)'}
            onClick={() => setRunning((v) => !v)}
            disabled={!ready}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              {running ? (
                <>
                  <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2" />
                </>
              ) : (
                <path d="m7 4 9 6-9 6z" fill="currentColor" />
              )}
            </svg>
          </button>
          <button
            className="tool-button"
            aria-label="Step simulation"
            title="Advance one step"
            onClick={() => {
              remember();
              setRunning(false);
              engine.current?._world_step(1 / 120);
            }}
            disabled={!ready}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5 5 7 5-7 5z" fill="currentColor" />
              <path d="M15 5v10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            className="tool-button"
            aria-label="Reset scene"
            title="Reset scene"
            onClick={() => loadScene(scene === 'custom' ? 'empty' : scene)}
            disabled={!ready}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M5 6a6 6 0 1 1-1 6M5 2v4h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </nav>
      <footer className="stage-bottom">
        <span role="status">{notice}</span>
        <span className="keyboard-hint">Space to pause · 1–5 to switch tools</span>
        <span className="scene-status">
          <span className="status-dot" data-running={running} />
          {running ? 'Running' : 'Paused'}
          <span className="body-count" data-testid="body-count">
            {metrics.count} {metrics.count === 1 ? 'body' : 'bodies'}
          </span>
        </span>
      </footer>
    </div>
  );
}
