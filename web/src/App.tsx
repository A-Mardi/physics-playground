import { useEffect, useRef, useState } from 'react';
import { loadEngine, readBodies, preset, presets, WIDTH, HEIGHT } from './engine';
import type { Body, Engine } from './engine';

type Tool = 'select' | 'circle' | 'box' | 'platform' | 'erase';
const colors = ['#83e8c1', '#8ab8ef', '#e9b477', '#bd9cea', '#ec919c'];
const tools: { id: Tool; symbol: string; label: string }[] = [
  { id: 'select', symbol: '↖', label: 'Select' },
  { id: 'circle', symbol: '○', label: 'Circle' },
  { id: 'box', symbol: '□', label: 'Box' },
  { id: 'platform', symbol: '╱', label: 'Platform' },
  { id: 'erase', symbol: '⌫', label: 'Erase' },
];
const initialMetrics = { fps: 0, step: 0, count: 0, contacts: 0, candidates: 0 };

function MiniScene({ kind }: { kind: string }) {
  return (
    <svg viewBox="0 0 64 44" aria-hidden="true">
      <path d="M4 38H60" stroke="#455751" />
      {kind === 'domino' ? (
        Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={10 + i * 8}
            y={12}
            width="4"
            height="25"
            rx="1"
            fill={colors[i % 5]}
            transform={i === 0 ? 'rotate(14 10 37)' : undefined}
          />
        ))
      ) : kind === 'stack' ? (
        Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={i < 3 ? 12 + i * 13 : i < 5 ? 18 + (i - 3) * 13 : 25}
            y={i < 3 ? 27 : i < 5 ? 15 : 3}
            width="11"
            height="10"
            rx="2"
            fill={colors[i % 5]}
          />
        ))
      ) : kind === 'empty' ? (
        <path d="M32 13v18m-9-9h18" stroke="#83e8c1" />
      ) : (
        Array.from({ length: kind === 'rain' ? 12 : 5 }, (_, i) => (
          <circle
            key={i}
            cx={10 + (i % 4) * 14}
            cy={8 + Math.floor(i / 4) * 13}
            r={kind === 'rain' ? 3 : 5}
            fill={colors[i % 5]}
          />
        ))
      )}
    </svg>
  );
}

export default function App() {
  const engine = useRef<Engine | null>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    input = useRef<HTMLInputElement>(null);
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
    [notice, setNotice] = useState('Drag a body. Add a shape. See what happens.');
  const live = useRef({ running, tool, speed, debug, size, selected: -1 });
  live.current = { running, tool, speed, debug, size, selected: selected?.id ?? -1 };
  const drag = useRef<{ id: number; dx: number; dy: number; angle: number } | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

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
            ctx.fillStyle = '#17211f';
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
            ctx.fillStyle = '#304039';
            for (let x = 20; x < WIDTH; x += 40)
              for (let y = 20; y < HEIGHT; y += 40) {
                ctx.beginPath();
                ctx.arc(x, y, 1.3, 0, Math.PI * 2);
                ctx.fill();
              }
            ctx.fillStyle = '#26372f';
            ctx.fillRect(0, 840, WIDTH, 40);
            ctx.strokeStyle = '#40594b';
            ctx.beginPath();
            ctx.moveTo(0, 840);
            ctx.lineTo(WIDTH, 840);
            ctx.stroke();
            for (const b of bodies) {
              if (b.id < 4) continue;
              ctx.save();
              ctx.translate(b.x, b.y);
              ctx.rotate(b.angle);
              ctx.fillStyle = b.fixed ? '#577264' : colors[b.id % colors.length];
              ctx.strokeStyle =
                b.id === live.current.selected ? '#ffffff' : b.fixed ? '#839c8e' : '#ffffff38';
              ctx.lineWidth = b.id === live.current.selected ? 3 : 1.5;
              ctx.beginPath();
              if (b.shape === 0) ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
              else ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, Math.min(4, b.h / 4));
              ctx.fill();
              ctx.stroke();
              if (b.shape === 0) {
                ctx.strokeStyle = '#16251e44';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(b.w * 0.16, 0);
                ctx.lineTo(b.w * 0.34, 0);
                ctx.stroke();
              }
              if (b.fixed) {
                ctx.strokeStyle = '#a1b4a560';
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
                ctx.strokeStyle = '#f5cf74';
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
              ctx.strokeStyle = '#c2fce3';
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
      if ((event.target as HTMLElement).matches('input,select,textarea,button')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setRunning((v) => !v);
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (live.current.selected >= 0) {
          event.preventDefault();
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
        e._body_remove(id);
        setSelected(null);
        return;
      }
      const b = readBodies(e).find((b) => b.id === id) ?? null;
      setSelected(b);
      if (b) {
        drag.current = { id, dx: b.x - p.x, dy: b.y - p.y, angle: b.angle };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } else {
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
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">◒</span>
          <div>
            <strong>
              KINETIC<span className="beta">BETA</span>
            </strong>
            <small>Physics playground</small>
          </div>
        </div>
        <div className="top-actions">
          <span className="engine-status">
            <i className={ready ? 'online' : ''} />
            {ready ? 'C++ engine ready' : 'Loading engine'}
          </span>
          <button onClick={() => save()} disabled={!ready}>
            Save scene
          </button>
          <button className="outline" onClick={() => save(true)} disabled={!ready}>
            Export ↗
          </button>
          <a
            href="https://github.com/A-Mardi/physics-playground"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            Source ↗
          </a>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="section-label">
            THE EXPERIMENTS <span>05</span>
          </div>
          <h2>A world in motion.</h2>
          <p className="sidebar-intro">
            Start with a scene.
            <br />
            Follow your curiosity.
          </p>
          <div className="scene-list">
            {presets.map((p) => (
              <button
                className={'scene-card ' + (scene === p.id ? 'active' : '')}
                onClick={() => loadScene(p.id)}
                disabled={!ready}
                key={p.id}
              >
                <MiniScene kind={p.id} />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="environment">
            <div className="section-label">WORLD SETTINGS</div>
            <label>
              Gravity <output>{gravity} px/s²</output>
              <input
                aria-label="Gravity"
                type="range"
                min="0"
                max="1600"
                step="20"
                value={gravity}
                onChange={(e) => setGravity(+e.target.value)}
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
                onChange={(e) => setBounce(+e.target.value)}
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
                onChange={(e) => setFriction(+e.target.value)}
              />
            </label>
          </div>
          <button
            className="subtle"
            onClick={() => {
              try {
                const saved = localStorage.getItem('kinetic.scene.v1');
                if (saved) restore(saved);
                else setNotice('No saved scene yet. Use Save scene first.');
              } catch {
                setNotice('Local storage is unavailable.');
              }
            }}
          >
            ↺ Restore saved scene
          </button>
          <button className="subtle" onClick={() => input.current?.click()}>
            ↑ Import scene JSON
          </button>
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
        </aside>
        <main className="stage">
          <div className="stage-heading">
            <div>
              <span className="section-label">YOUR SANDBOX</span>
              <h1>{presets.find((p) => p.id === scene)?.name ?? 'Your experiment'}</h1>
            </div>
            <div className="transport">
              <button
                aria-label="Reset scene"
                title="Reset scene"
                onClick={() => loadScene(scene === 'custom' ? 'empty' : scene)}
                disabled={!ready}
              >
                ↺
              </button>
              <button
                aria-label="Step simulation"
                title="Advance one fixed step"
                onClick={() => {
                  setRunning(false);
                  engine.current?._world_step(1 / 120);
                }}
                disabled={!ready}
              >
                ▹│
              </button>
              <button className="play" onClick={() => setRunning((v) => !v)} disabled={!ready}>
                {running ? 'Ⅱ Pause' : '▶ Play'}
              </button>
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
            </div>
          </div>
          <div className="canvas-wrap">
            <div className="canvas-label">
              <span className={running ? 'live-dot' : 'paused-dot'} />
              {running ? 'SIMULATING' : 'PAUSED'}
              <span className="canvas-coordinate">1400 × 880 world</span>
            </div>
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
                  if (d) engine.current?._body_move(d.id, p.x + d.dx, p.y + d.dy, d.angle);
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
            <div className="floating-tools" aria-label="Scene tools">
              {tools.map((t, i) => (
                <button
                  key={t.id}
                  aria-pressed={tool === t.id}
                  className={tool === t.id ? 'chosen' : ''}
                  onClick={() => setTool(t.id)}
                  title={`${t.label} (${i + 1})`}
                >
                  <b>{t.symbol}</b>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="stage-bottom">
            <span role="status">{notice}</span>
            <span>
              <kbd>SPACE</kbd> pause <kbd>1–5</kbd> tools <kbd>DEL</kbd> remove
            </span>
          </div>
        </main>
        <aside className="inspector">
          <div className="section-label">
            LIVE TELEMETRY <i className="online" />
          </div>
          <div className="big-metric">
            <strong>{metrics.count}</strong>
            <span>bodies in scene</span>
          </div>
          <div className="metric-grid">
            <div>
              <strong>
                {metrics.fps}
                <small> fps</small>
              </strong>
              <span>Render rate</span>
            </div>
            <div>
              <strong>
                {metrics.step.toFixed(2)}
                <small> ms</small>
              </strong>
              <span>Mean physics step</span>
            </div>
            <div>
              <strong>{metrics.contacts}</strong>
              <span>Contact pairs</span>
            </div>
            <div>
              <strong>{metrics.candidates}</strong>
              <span>Candidate pairs</span>
            </div>
          </div>
          <p className="metric-note">
            Live measurements on your device.
            <br />
            Fixed simulation step: 120 Hz.
          </p>
          <label className="toggle">
            <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />{' '}
            Show velocity vectors
          </label>
          <div className="inspector-section">
            <div className="section-label">CREATE A BODY</div>
            <label>
              Size <output>{size} px</output>
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
            <p>Select a shape in the toolbar, then click anywhere in the scene.</p>
          </div>
          <div className="inspector-section">
            <div className="section-label">{selected ? 'SELECTED BODY' : 'BODY INSPECTOR'}</div>
            {selected ? (
              <>
                <h3>
                  {selected.fixed ? 'Static platform' : selected.shape === 0 ? 'Circle' : 'Box'}{' '}
                  <span>#{selected.id}</span>
                </h3>
                <dl>
                  <dt>Position</dt>
                  <dd>
                    {Math.round(selected.x)}, {Math.round(selected.y)}
                  </dd>
                  <dt>Speed</dt>
                  <dd>{Math.round(Math.hypot(selected.vx, selected.vy))} px/s</dd>
                  <dt>Angle</dt>
                  <dd>{Math.round((selected.angle * 180) / Math.PI)}°</dd>
                </dl>
                <label>
                  Rotation{' '}
                  <input
                    aria-label="Body rotation"
                    type="range"
                    min="-180"
                    max="180"
                    value={Math.round((selected.angle * 180) / Math.PI)}
                    onChange={(event) => {
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
                  className="delete"
                  onClick={() => {
                    engine.current?._body_remove(selected.id);
                    setSelected(null);
                  }}
                >
                  Remove body
                </button>
              </>
            ) : (
              <div className="empty-inspector">
                <span>↖</span>
                <p>
                  Select a body to inspect
                  <br />
                  its position and motion.
                </p>
              </div>
            )}
          </div>
          <div className="engine-credit">
            <span>BUILT TO BE EXPLORED</span>
            <p>
              Custom C++ physics.
              <br />
              WebAssembly execution.
              <br />
              No server required.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
