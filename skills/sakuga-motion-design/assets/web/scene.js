import { clamp, mix, stepSpring, createClock, createEffects } from "./motion.js";
import { PROFILES, applyCssProfile } from "./profiles.js";

const CHAPTERS = {
  pressure: { title: "Pressure", description: "A held shape gathers force before it breaks." },
  flight: { title: "Flight", description: "The longest shape marks the fastest instant." },
  arrival: { title: "Arrival", description: "The plate lands. The dust finishes the sentence." },
};
const PLACES = {
  left: { x: .19, label: "Left" },
  center: { x: .5, label: "Centre" },
  right: { x: .81, label: "Right" },
};
const chapterOrder = Object.keys(CHAPTERS);
const placeOrder = Object.keys(PLACES);
const forwardAngle = (direction) => direction > 0 ? 0 : Math.PI;
const distance = (value, target) => Math.abs(value - target);
const easeOut = (t) => 1 - (1 - clamp(t)) ** 3;
const round = (n) => Math.round(n * 10000) / 10000;

export function mountDemo(root) {
  const get = (name) => root.querySelector(`[data-${name}]`);
  const all = (name) => [...root.querySelectorAll(`[data-${name}]`)];
  const board = get("dragboard");
  const artwork = get("artwork");
  const artworkFace = get("artwork-face");
  const press = get("confirm");
  const pressFace = get("press-face");
  const chapterPanel = get("chapter-panel");
  const title = get("chapter-title");
  const plate = get("plate");
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const on = (el, type, handler) => el.addEventListener(type, handler, { signal: events.signal });
  let preset = "restrained";
  let profile = PROFILES[preset];
  let reduced = media.matches;
  let destroyed = false;
  let chapter = "pressure";
  let placement = "center";
  let registrations = 0;
  let pointerPress = null;
  let keyPress = false;
  let impact = null;
  let reveal = null;
  let gesture = null;
  let releaseSpeed = 0;
  let trailCredit = 0;
  let lastDirection = 0;
  let target = PLACES[placement].x;
  let artworkStretch = 1;
  let pressScale = 1;
  let chapterOffset = 0;
  const slide = { x: target, v: 0 };
  const squash = { x: 1, v: 0 };
  const canvases = Object.fromEntries(all("fx").map((canvas) => [canvas.dataset.fx, canvas]));
  const effects = createEffects(canvases, () => profile);
  const clock = createClock(render);
  const wake = () => { if (!reduced) clock.wake(); };

  function add(channel, kind, point, options) {
    if (!reduced) effects.add(channel, kind, point, options, clock.now);
  }

  function updatePressPose(now, dt) {
    if (reduced) return false;
    const pressed = keyPress || pointerPress !== null;
    const recipe = profile.press;
    let hit = false;
    let value;
    let turn = 0;
    if (pressed) {
      stepSpring(squash, recipe.heldScale, dt, 310, 27);
      value = squash.x;
    } else if (impact) {
      const elapsed = now - impact.start;
      const first = recipe.flashMs;
      const second = recipe.settleMs * .46;
      hit = elapsed < first;
      value = elapsed < first ? mix(recipe.hitScale, recipe.hitScale + .12, elapsed / first)
        : elapsed < second ? mix(recipe.hitScale + .12, 1 + recipe.overshoot, easeOut((elapsed - first) / (second - first)))
          : mix(1 + recipe.overshoot, 1, easeOut((elapsed - second) / (recipe.settleMs - second)));
      turn = -3.7 * profile.effects.range * (1 - clamp(elapsed / recipe.settleMs));
      if (!impact.followed && elapsed >= first + 24) {
        impact.followed = true;
        const anchor = effects.point("impact", press);
        for (const sign of [-1, 1]) {
          add("impact", "puff", { x: anchor.x + sign * press.offsetWidth * .46, y: anchor.y + 16 },
            { size: 22, life: 620, vx: sign * 52, vy: -44 });
        }
      }
      if (elapsed >= recipe.settleMs) impact = null;
      squash.x = value;
      squash.v = 0;
    } else {
      stepSpring(squash, 1, dt, 290, 22);
      value = squash.x;
    }
    pressScale = value;
    press.toggleAttribute("data-hit", hit);
    pressFace.style.transform = value === 1 && turn === 0 ? "" :
      `rotate(${turn}deg) scale(${1 / Math.sqrt(value)}, ${value})`;
    return impact !== null || squash.v !== 0 || squash.x !== (pressed ? recipe.heldScale : 1);
  }

  function handlePressDown() {
    if (reduced) return;
    impact = null;
    effects.clear("impact");
    const at = effects.point("impact", press, .72, .22);
    add("impact", "wedge", at, { size: 15, life: 200, angle: -1.1, vx: 6, vy: -20 });
    wake();
  }

  function registerPrint() {
    registrations += 1;
    get("count").textContent = registrations === 1 ? "1 print registered" : `${registrations} prints registered`;
    if (reduced) return;
    impact = { start: clock.now, followed: false };
    effects.clear("impact");
    const anchor = effects.point("impact", press);
    add("impact", "burst", anchor, { size: 97, life: 260 });
    const count = Math.round(7 * profile.effects.density);
    for (let i = 0; i < count; i++) {
      const angle = i * 2 * Math.PI / count + effects.between(-.27, .27);
      const speed = effects.between(62, 128);
      add("impact", "shard", anchor, {
        size: effects.between(4, 8), life: effects.between(295, 465),
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: 210,
      });
    }
    if (profile.effects.lettering === "vector-thump") {
      add("impact", "word", { x: anchor.x + press.offsetWidth * .42, y: anchor.y - 42 },
        { size: 55, life: 430, angle: -.18, vx: 18, vy: -24 });
    }
    updatePressPose(clock.now, 0);
    effects.draw(clock.now);
    wake();
  }

  function updateChapterPose(now) {
    if (!reveal) return false;
    const { plateTravel, overshoot, totalMs } = profile.reveal;
    const progress = clamp((now - reveal.start) / totalMs);
    const direction = reveal.direction;
    if (progress >= 1) {
      reveal = null;
      resetChapterPose();
      return false;
    }
    // The entry travels towards the reading position. Overshoot reverses the sign before resting.
    const settle = progress < .48
      ? mix(-1, overshoot, easeOut(progress / .48))
      : mix(overshoot, 0, easeOut((progress - .48) / .52));
    chapterOffset = settle * reveal.titleTravel * direction;
    title.style.transform = `translateX(${chapterOffset}px) scaleX(${1 + settle * .04})`;
    plate.style.transform = `translateX(${settle * plateTravel * direction}px) scale(${1 - settle * .14}, ${1 + settle * .08}) rotate(${settle * 5 * direction}deg)`;
    if (!reveal.followed && progress >= .31) {
      reveal.followed = true;
      const anchor = effects.point("chapter", plate, .5, .57);
      const count = Math.ceil(profile.effects.density * 2);
      for (let i = 0; i < count; i++) {
        add("chapter", "puff", { x: anchor.x - direction * (24 + i * 26), y: anchor.y + i * 9 },
          { size: 17 + i * 4, life: 340 + i * 46, vx: -direction * 48, vy: -42 });
      }
    }
    return true;
  }

  function resetChapterPose() {
    title.style.transform = "";
    plate.style.transform = "";
    chapterOffset = 0;
  }

  function selectChapter(value) {
    if (value === chapter) return;
    const direction = chapterOrder.indexOf(value) > chapterOrder.indexOf(chapter) ? 1 : -1;
    chapter = value;
    const data = CHAPTERS[value];
    chapterPanel.dataset.chapterCurrent = value;
    title.textContent = data.title;
    get("chapter-description").textContent = data.description;
    get("chapter-index").textContent = `Study 0${chapterOrder.indexOf(value) + 1} / 03`;
    get("chapter-announcement").textContent = `Now showing ${data.title}`;
    for (const button of all("chapter")) button.setAttribute("aria-pressed", String(button.dataset.chapter === value));
    effects.clear("chapter");
    if (reduced) return;
    // The new reaction starts from its own canonical layout, independent of the previous reveal.
    resetChapterPose();
    const gutter = effects.point("chapter", title, 0, 0).x;
    const titleTravel = Math.min(profile.reveal.titleTravel, Math.max(0, gutter - 3));
    reveal = { start: clock.now, direction, titleTravel, followed: false };
    const anchor = effects.point("chapter", plate, .48, .5);
    const primarySize = Math.min(124, effects.bounds("chapter").width * .3);
    add("chapter", "slash", anchor, { size: primarySize, life: profile.reveal.totalMs * .69, angle: -.32 + forwardAngle(direction), vx: direction * 70 });
    if (profile.effects.density > .7) {
      add("chapter", "wedge", { x: anchor.x - direction * 24, y: anchor.y + 30 },
        { size: 41, life: 300, angle: -.19 + forwardAngle(direction), vx: direction * 70 });
      add("chapter", "wedge", { x: anchor.x + direction * 28, y: anchor.y - 26 },
        { size: 29, life: 230, angle: -.29 + forwardAngle(direction), vx: direction * 93, vy: -20 });
    }
    updateChapterPose(clock.now);
    effects.draw(clock.now);
    wake();
  }

  function paintArtwork(x, speed) {
    const { fullSpeed, stretch } = profile.drag;
    const amount = reduced ? 0 : clamp(Math.abs(speed) / fullSpeed) * stretch;
    const direction = Math.sign(speed);
    artworkStretch = 1 + amount;
    artwork.style.left = `${clamp(x, .17, .83) * 100}%`;
    artworkFace.style.transformOrigin = direction > 0 ? "88% 50%" : "12% 50%";
    artworkFace.style.transform = amount === 0 ? "" :
      `rotate(${direction * amount * 10}deg) scale(${1 + amount}, ${1 / (1 + amount)})`;
  }

  function trails(speed, strength) {
    const sign = Math.sign(speed);
    const anchor = effects.point("drag", artwork, .5 - sign * .51, .58);
    const point = {
      x: anchor.x - sign * mix(3, 14, strength),
      y: anchor.y + effects.between(-4, 7),
    };
    add("drag", "puff", point, {
      size: mix(8, 19, strength), life: mix(240, 490, strength), vx: -sign * mix(30, 89, strength), vy: -mix(13, 52, strength),
    });
    add("drag", "line", { x: point.x, y: point.y - 11 }, {
      size: mix(22, 63, strength), life: 230, angle: forwardAngle(-sign), vx: -sign * 43,
    });
  }

  function updateArtwork(now, dt) {
    if (reduced) return false;
    const { drag, effects: style } = profile;
    stepSpring(slide, target, dt, drag.stiffness, drag.damping);
    const speed = gesture ? currentGestureSpeed(gesture, now) : slide.v * .52;
    paintArtwork(slide.x, speed);
    if (gesture && Math.abs(speed) > drag.threshold) {
      const strength = clamp((Math.abs(speed) - drag.threshold) / (drag.fullSpeed - drag.threshold));
      trailCredit += dt * drag.trailRate * mix(.45, 1, strength) * style.density;
      while (trailCredit >= 1) {
        trailCredit -= 1;
        trails(speed, strength);
      }
    }
    return slide.x !== target || slide.v !== 0 || (gesture && Math.abs(speed) > .015);
  }

  function render(now, dt) {
    const movingPress = updatePressPose(now, dt);
    const movingChapter = updateChapterPose(now);
    const movingArtwork = updateArtwork(now, dt);
    const drawing = effects.draw(now);
    return movingPress || movingChapter || movingArtwork || drawing;
  }

  function nearestPlace(position) {
    return placeOrder.reduce((best, place) => distance(position, PLACES[place].x) < distance(position, PLACES[best].x) ? place : best);
  }

  function commitPlacement(value) {
    const changed = placement !== value;
    placement = value;
    target = PLACES[value].x;
    const { label } = PLACES[value];
    artwork.setAttribute("aria-valuenow", String(placeOrder.indexOf(value) + 1));
    artwork.setAttribute("aria-valuetext", label);
    for (const button of all("place")) button.setAttribute("aria-pressed", String(button.dataset.place === value));
    if (changed) get("placement-announcement").textContent = `Print placed at ${label.toLowerCase()}`;
    if (reduced) {
      slide.x = target;
      paintArtwork(target, 0);
    }
    wake();
  }

  function currentGestureSpeed(input, now) {
    const age = clock.manual ? now - input.motionAt : performance.now() - input.eventAt;
    return input.speed * Math.exp(-Math.max(0, age) / 85);
  }

  function dropGesture() {
    const input = gesture;
    gesture = null;
    trailCredit = 0;
    artwork.removeAttribute("data-dragging");
    if (input && artwork.hasPointerCapture(input.pointer)) artwork.releasePointerCapture(input.pointer);
    return input;
  }

  function cancelDrag() {
    if (!gesture) return;
    dropGesture();
    releaseSpeed = 0;
    effects.clear("drag");
    effects.draw(clock.now);
    commitPlacement(placement);
  }

  on(artwork, "pointerdown", (event) => {
    if (gesture || !event.isPrimary || event.button !== 0) return;
    const rect = board.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    const start = clamp(slide.x, .17, .83);
    gesture = { pointer: event.pointerId, rect, offset: fraction - start, x: start,
      speed: 0, eventAt: event.timeStamp, motionAt: clock.now };
    artwork.setPointerCapture(event.pointerId);
    artwork.setAttribute("data-dragging", "");
    effects.clear("drag");
    releaseSpeed = 0;
    lastDirection = 0;
    trailCredit = .42 * profile.effects.density;
    wake();
  });

  on(artwork, "pointermove", (event) => {
    if (gesture?.pointer !== event.pointerId) return;
    const input = gesture;
    const next = clamp((event.clientX - input.rect.left) / input.rect.width - input.offset, .19, .81);
    const ms = clock.manual ? clock.now - input.motionAt : event.timeStamp - input.eventAt;
    const speed = clamp((next - input.x) * 1000 / Math.max(8, ms), -4.5, 4.5);
    const blend = 1 - Math.exp(-Math.max(8, ms) / 34);
    input.speed = mix(currentGestureSpeed(input, clock.now), speed, blend);
    if (Math.abs(speed) > .06) {
      lastDirection = Math.sign(speed);
      if (lastDirection !== Math.sign(input.speed)) input.speed = speed * blend;
    }
    input.x = next;
    input.eventAt = event.timeStamp;
    input.motionAt = clock.now;
    target = next;
    if (reduced) {
      slide.x = next;
      paintArtwork(next, 0);
    }
    wake();
  });

  on(artwork, "pointerup", (event) => {
    if (gesture?.pointer !== event.pointerId) return;
    const current = gesture;
    releaseSpeed = currentGestureSpeed(current, clock.now);
    const sign = Math.sign(releaseSpeed);
    const destination = nearestPlace(current.x);
    dropGesture();
    const { releaseThreshold, fullSpeed } = profile.drag;
    if (!reduced && Math.abs(releaseSpeed) > releaseThreshold) {
      const anchor = effects.point("drag", artwork, .5 + sign * .42, .47);
      const strength = clamp(Math.abs(releaseSpeed) / fullSpeed);
      const { width } = effects.bounds("drag");
      // Predict the leading edge at the snap point so the spring-lagging poster cannot overtake the slash.
      const end = PLACES[destination].x * width + sign * artwork.offsetWidth * .42;
      const ahead = sign > 0 ? Math.max(anchor.x, end) : Math.min(anchor.x, end);
      add("drag", "slash", { x: clamp(ahead, 18, width - 18), y: anchor.y - 9 }, {
        size: mix(36, 62, strength), life: 335, angle: forwardAngle(sign), vx: sign * mix(81, 126, strength),
      });
      effects.draw(clock.now);
    }
    commitPlacement(destination);
  });

  for (const eventName of ["pointercancel", "lostpointercapture"]) {
    on(artwork, eventName, (event) => { if (gesture?.pointer === event.pointerId) cancelDrag(); });
  }

  function placeDirectly(value) {
    cancelDrag();
    releaseSpeed = 0;
    lastDirection = 0;
    effects.clear("drag");
    effects.draw(clock.now);
    commitPlacement(value);
  }

  on(artwork, "keydown", (event) => {
    if (event.key === "Escape" && gesture) {
      event.preventDefault();
      cancelDrag();
      return;
    }
    const delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    const index = event.key === "Home" ? 0
      : event.key === "End" ? placeOrder.length - 1
        : delta ? clamp(placeOrder.indexOf(placement) + delta, 0, placeOrder.length - 1) : null;
    if (index === null) return;
    event.preventDefault();
    placeDirectly(placeOrder[index]);
  });

  on(press, "pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    pointerPress = event.pointerId;
    handlePressDown();
  });
  for (const type of ["pointerup", "pointercancel", "pointermove"]) {
    on(window, type, (event) => {
      if (pointerPress !== event.pointerId) return;
      if (type === "pointermove" && press.contains(event.target)) return;
      pointerPress = null;
      wake();
    });
  }
  on(press, "keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (event.repeat) { event.preventDefault(); return; }
    if (event.key === " ") {
      keyPress = true;
      handlePressDown();
    }
  });
  on(press, "keyup", (event) => {
    if (event.key === " ") { keyPress = false; wake(); }
  });
  on(press, "blur", () => { keyPress = false; wake(); });
  on(press, "click", registerPrint);

  function clearTransient() {
    clock.sleep();
    dropGesture();
    pointerPress = null;
    keyPress = false;
    impact = null;
    reveal = null;
    releaseSpeed = 0;
    lastDirection = 0;
    target = PLACES[placement].x;
    Object.assign(slide, { x: target, v: 0 });
    Object.assign(squash, { x: 1, v: 0 });
    pressScale = 1;
    press.removeAttribute("data-hit");
    pressFace.style.transform = "";
    resetChapterPose();
    paintArtwork(target, 0);
    effects.clear();
    effects.draw(clock.now);
  }

  function setProfile(value) {
    preset = value;
    profile = PROFILES[value];
    root.dataset.activePreset = value;
    applyCssProfile(root, profile);
    for (const button of all("preset")) button.setAttribute("aria-pressed", String(button.dataset.preset === value));
    effects.resize();
    clearTransient();
  }

  function onResize() {
    if (effects.resize()) clearTransient();
  }

  const resizeObserver = new ResizeObserver(onResize);
  for (const canvas of Object.values(canvases)) resizeObserver.observe(canvas);
  for (const button of all("preset")) on(button, "click", () => { if (preset !== button.dataset.preset) setProfile(button.dataset.preset); });
  for (const button of all("chapter")) on(button, "click", () => selectChapter(button.dataset.chapter));
  for (const button of all("place")) on(button, "click", () => placeDirectly(button.dataset.place));
  on(media, "change", (event) => { reduced = event.matches; clearTransient(); });
  on(window, "resize", onResize);
  on(window, "blur", clearTransient);
  on(window, "pagehide", clearTransient);
  on(document, "visibilitychange", () => { if (document.hidden) clearTransient(); });
  setProfile(preset);

  return {
    state() {
      return {
        preset, reduced, chapter, placement, registrations, destroyed,
        now: round(clock.now), manual: clock.manual, running: clock.running,
        dragging: gesture !== null, pressed: keyPress || pointerPress !== null,
        preview: round(target), artworkPosition: round(slide.x), artworkStretch: round(artworkStretch),
        dragSpeed: gesture ? round(currentGestureSpeed(gesture, clock.now)) : 0,
        releaseSpeed: round(releaseSpeed), lastDirection,
        pressScale: round(pressScale), hit: press.hasAttribute("data-hit"), chapterOffset: round(chapterOffset),
        effects: effects.inspect(), layout: Object.fromEntries(Object.keys(canvases).map((name) => [name, effects.bounds(name)])),
      };
    },
    pause(seed = 19921) {
      clock.pause();
      clearTransient();
      effects.setSeed(seed);
    },
    step(ms) { clock.step(ms); },
    resume() {
      clearTransient();
      effects.setSeed(null);
      clock.resume();
    },
    destroy() {
      if (destroyed) return;
      clearTransient();
      clock.destroy();
      events.abort();
      resizeObserver.disconnect();
      destroyed = true;
    },
  };
}

const demo = document.querySelector("[data-motion-demo]");
if (demo) window.sakugaDemo = mountDemo(demo);
