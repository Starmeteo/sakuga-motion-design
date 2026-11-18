export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
export const mix = (from, to, t) => from + (to - from) * t;

export function stepSpring(spring, target, dt, stiffness, damping) {
  spring.v += ((target - spring.x) * stiffness - spring.v * damping) * dt;
  spring.x += spring.v * dt;
  if (Math.abs(target - spring.x) < .00035 && Math.abs(spring.v) < .004) {
    spring.x = target;
    spring.v = 0;
  }
}

export function createClock(render) {
  const quantum = 1000 / 120;
  let playedAt = 0;
  let sampledAt = 0;
  let stepId = 0;
  let previous = 0;
  let manual = false;
  let destroyed = false;

  function advance(ms) {
    let active;
    do {
      const step = Math.min(ms, quantum);
      if (manual) sampledAt += step;
      else playedAt += step;
      active = render(manual ? sampledAt : playedAt, step / 1000);
      ms -= step;
    } while (ms > 1e-7);
    return active;
  }

  function tick(timestamp) {
    stepId = 0;
    const elapsed = clamp(timestamp - previous, 0, 40);
    previous = timestamp;
    if (advance(elapsed) && !stepId) stepId = requestAnimationFrame(tick);
  }

  function stop() {
    if (stepId) cancelAnimationFrame(stepId);
    stepId = 0;
  }

  return {
    get now() { return manual ? sampledAt : playedAt; },
    get manual() { return manual; },
    get running() { return Boolean(stepId); },
    wake() {
      if (destroyed || manual || stepId) return;
      previous = performance.now();
      stepId = requestAnimationFrame(tick);
    },
    pause() {
      stop();
      sampledAt = 0;
      manual = true;
    },
    sleep: stop,
    step(ms) {
      if (!manual || destroyed || !Number.isFinite(ms) || ms < 0 || ms > 10_000) {
        throw new RangeError("Pause first, then advance by 0–10000 ms.");
      }
      advance(ms);
    },
    resume() {
      manual = false;
      this.wake();
    },
    destroy() {
      stop();
      destroyed = true;
    },
  };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
}

function paint(ctx, color) {
  ctx.fillStyle = color;
  ctx.fill();
  ctx.stroke();
}

function burst(ctx, radius, time, variation, colors) {
  const grow = .42 + .58 * Math.sin(Math.min(1, time / .22) * Math.PI / 2);
  const thin = (1 - time) ** .65;
  const spikes = 11;
  const outline = Array.from({ length: spikes * 2 }, (_, i) => {
    const angle = variation + i * Math.PI / spikes;
    const length = i % 2 ? .21 : (.75 + .24 * Math.sin(i * 1.9 + variation)) * grow;
    return [Math.cos(angle) * radius * length, Math.sin(angle) * radius * length];
  });
  ctx.scale(thin, thin);
  polygon(ctx, outline);
  paint(ctx, colors.shadow);
  ctx.scale(.76, .76);
  polygon(ctx, outline);
  paint(ctx, colors.card);
}

function puffs(ctx, radius, time, variation, colors) {
  ctx.scale((1 - time) ** .75, (1 - time) ** .75);
  const grown = radius * (.67 + .46 * Math.sin(Math.min(1, time / .32) * Math.PI / 2));
  polygonCloud(ctx, grown, variation);
  paint(ctx, colors.shadow);
  ctx.save();
  ctx.clip();
  ctx.translate(-grown * .13, -grown * .25);
  polygonCloud(ctx, grown * .93, variation);
  ctx.fillStyle = colors.card;
  ctx.fill();
  ctx.restore();
  polygonCloud(ctx, grown, variation);
  ctx.stroke();
}

function polygonCloud(ctx, size, variation) {
  const lobes = Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6 + variation;
    const r = size * (i % 2 ? .73 : 1.08 + .14 * Math.sin(i * 3 + variation));
    return [Math.cos(angle) * r, Math.sin(angle) * r * .81];
  });
  ctx.beginPath();
  ctx.moveTo((lobes[11][0] + lobes[0][0]) / 2, (lobes[11][1] + lobes[0][1]) / 2);
  for (const [i, [x, y]] of lobes.entries()) {
    const [nx, ny] = lobes[(i + 1) % lobes.length];
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
  }
  ctx.closePath();
}

function shard(ctx, r, time, variation, colors) {
  ctx.rotate(variation + time * 4);
  ctx.scale(1 - time, 1 - time);
  polygon(ctx, [[-r, -.48 * r], [.48 * r, -.95 * r], [.92 * r, .23 * r], [-.07 * r, r]]);
  paint(ctx, colors.shadow);
  polygon(ctx, [[-r, -.48 * r], [.48 * r, -.95 * r], [-.12 * r, .2 * r]]);
  paint(ctx, colors.card);
}

function wedge(ctx, size, time, _variation, colors) {
  const width = size * (1 - time);
  const height = width * .23;
  polygon(ctx, [[-width * .35, -height], [width, 0], [-width * .51, height * .8]]);
  paint(ctx, colors.accent);
}

function slash(ctx, size, time, _variation, colors) {
  const r = size * (.55 + Math.min(1, time * 6) * .45);
  ctx.scale(1 - time * .53, (1 - time) ** 1.3);
  ctx.beginPath();
  ctx.moveTo(-r * .68, r * .11);
  ctx.quadraticCurveTo(r * .09, -r * .2, r, -r * .03);
  ctx.quadraticCurveTo(r * .23, -.03 * r, -r * .16, .15 * r);
  ctx.closePath();
  paint(ctx, colors.card);
  ctx.beginPath();
  ctx.moveTo(-r * .39, r * .067);
  ctx.quadraticCurveTo(r * .04, -.064 * r, r * .54, -.069 * r);
  ctx.stroke();
}

function line(ctx, radius, time, _variation, colors) {
  const length = radius * (1 - time);
  polygon(ctx, [[-length * .21, -1.5 * (1 - time)], [length, .25], [-length * .55, 1]]);
  ctx.fillStyle = colors.ink;
  ctx.fill();
}

// Original hand-lettered gesture in unit paths, independent of the system font.
const THUMP = [
  [[0, 1, 14, 0], [7, 1, 6, 16]],
  [[1, 0, 0, 16], [12, 0, 11, 15], [2, 8, 10, 8]],
  [[0, 0, 0, 12, 3, 16, 8, 15, 11, 11, 12, 0]],
  [[0, 16, 1, 1, 7, 9, 14, 0, 12, 16]],
  [[1, 16, 2, 0, 10, 0, 13, 3, 11, 7, 3, 8]],
];

function word(ctx, radius, time, _variation, colors) {
  const scale = radius / 53 * (.83 + Math.sin(Math.min(1, time / .22) * Math.PI / 2) * .24) * (1 - time) ** .6;
  ctx.scale(scale, scale);
  ctx.translate(-45, -7);
  ctx.beginPath();
  for (const [i, strokes] of THUMP.entries()) {
    for (const path of strokes) {
      const offset = i * 18;
      ctx.moveTo(path[0] + offset, path[1]);
      for (let j = 2; j < path.length; j += 2) ctx.lineTo(path[j] + offset, path[j + 1]);
    }
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = colors.ink;
  ctx.stroke();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = colors.card;
  ctx.stroke();
}

const DRAW = { burst, puff: puffs, shard, wedge, slash, line, word };
const PRIORITY = { drag: 1, impact: 2, chapter: 3 };

export function createEffects(canvases, getProfile) {
  const layers = Object.fromEntries(Object.entries(canvases).map(([name, canvas]) => [
    name, { canvas, ctx: canvas.getContext("2d"), width: 0, height: 0, dirty: false },
  ]));
  let live = [];
  let emitted = {};
  let last = null;
  let random = Math.random;

  function resize() {
    let changed = false;
    for (const layer of Object.values(layers)) {
      const { canvas, ctx } = layer;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const dw = Math.max(1, Math.round(width * dpr));
      const dh = Math.max(1, Math.round(height * dpr));
      if (canvas.width === dw && canvas.height === dh && layer.width === width && layer.height === height) continue;
      canvas.width = dw;
      canvas.height = dh;
      ctx.setTransform(dw / Math.max(1, width), 0, 0, dh / Math.max(1, height), 0, 0);
      Object.assign(layer, { width, height, dirty: false });
      changed = true;
    }
    return changed;
  }

  return {
    resize,
    point(channel, element, x = .5, y = .5) {
      const from = layers[channel].canvas.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width * x - from.left, y: rect.top + rect.height * y - from.top };
    },
    bounds(channel) {
      const { width, height } = layers[channel];
      return { width, height };
    },
    between(min, max) { return mix(min, max, random()); },
    add(channel, kind, point, options, now) {
      const { effects } = getProfile();
      if (live.length >= effects.cap) {
        let evicted = -1;
        let lowest = PRIORITY[channel] + 1;
        for (const [i, particle] of live.entries()) {
          const priority = PRIORITY[particle.channel];
          if (priority < lowest) {
            evicted = i;
            lowest = priority;
          }
        }
        if (evicted < 0) return;
        live.splice(evicted, 1);
      }
      const { size, life, angle = 0, vx = 0, vy = 0, gravity = 0 } = options;
      const bounds = this.bounds(channel);
      const scale = effects.range * clamp(bounds.width / 345, .62, 1);
      live.push({
        channel, kind, ...point, created: now, size: size * scale, life: life * effects.duration,
        angle, vx: vx * scale, vy: vy * scale, gravity: gravity * scale, variation: random() * Math.PI * 2,
      });
      const key = `${channel}:${kind}`;
      emitted[key] = (emitted[key] || 0) + 1;
      last = { channel, kind, ...point, angle, vx, vy };
    },
    clear(channel) {
      live = channel ? live.filter((p) => p.channel !== channel) : [];
    },
    setSeed(seed) {
      random = seed == null ? Math.random : seededRandom(seed);
      emitted = {};
      last = null;
    },
    inspect() {
      const counts = {};
      for (const { channel, kind } of live) {
        const key = `${channel}:${kind}`;
        counts[key] = (counts[key] || 0) + 1;
      }
      return { active: live.length, counts, emitted: { ...emitted }, last: last && { ...last } };
    },
    draw(now) {
      const { colors, shape } = getProfile();
      live = live.filter((p) => now - p.created < p.life);
      for (const layer of Object.values(layers)) {
        if (layer.dirty) layer.ctx.clearRect(0, 0, layer.width, layer.height);
        layer.dirty = false;
      }
      for (const p of live) {
        const { ctx } = layers[p.channel];
        layers[p.channel].dirty = true;
        const age = Math.max(0, now - p.created);
        const seconds = age / 1000;
        ctx.save();
        ctx.translate(p.x + p.vx * seconds, p.y + p.vy * seconds + .5 * p.gravity * seconds ** 2);
        ctx.rotate(p.angle);
        ctx.strokeStyle = colors.ink;
        ctx.lineWidth = shape.effectStroke * Math.min(1, (1 - age / p.life) * 3);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        DRAW[p.kind](ctx, p.size, age / p.life, p.variation, colors);
        ctx.restore();
      }
      return live.length > 0;
    },
  };
}
