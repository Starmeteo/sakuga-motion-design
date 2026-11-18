import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const { values: args } = parseArgs({ options: Object.fromEntries(
  ['case', 'input', 'out', 'playwright', 'chromium', 'selectors'].map(key => [key, { type: 'string' }]),
) });
if (!['03', '04'].includes(args.case) || !args.input || !args.out || !args.playwright) {
  throw new Error('Usage: node check-scenes.mjs --case 03|04 --input <sample directory> --out <report directory> --playwright <index.mjs> [--chromium <executable>] [--selectors <JSON file>]');
}

const caseId = args.case;
const output = resolve(args.out);
const sample = resolve(args.input);
const options = args.selectors ? JSON.parse(await readFile(args.selectors, 'utf8')) : {};
const desktop = { viewport: { width: 1360, height: 920 } };
const mobile = { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const chapterNames = ['纸面', '走墨', '收版'];
const profileNames = ['克制', '表现'];
const selectors = {
  title: 'main h1, main h2, h1',
  description: 'main [aria-describedby], .description',
  board: 'canvas, figure, [role="img"]',
  count: 'output, [role="status"]',
  effects: '',
  ...options,
};
const report = {
  case: caseId, sample, selectors, desktop, mobile,
  checks: [], observations: {}, frames: [], runtime: [],
};
const chapter = caseId === '03';
const names = chapter ? chapterNames : [...profileNames, '落版'];
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };

await mkdir(output, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(sample, `.${pathname === '/' ? '/index.html' : pathname}`);
    const traversal = relative(sample, file);
    if (traversal.startsWith('..') || isAbsolute(traversal)) {
      response.writeHead(403).end();
      return;
    }
    const contents = await readFile(file);
    response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }).end(contents);
  } catch {
    if (request.url === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

function check(id, condition, detail) {
  report.checks.push({ id, status: condition ? 'pass' : 'fail', detail });
}

function installCapture() {
  const keys = new WeakMap();
  let id = 0;
  const events = [];
  const frames = [];
  let frameRequest = 0;
  let config;

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  function box(node) {
    if (!node) return null;
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x: round(x), y: round(y), width: round(width), height: round(height) };
  }

  function label(node) {
    if (!node) return null;
    return `${node.localName}${node.id ? `#${node.id}` : ''}${node.classList.length ? `.${[...node.classList].join('.')}` : ''}`;
  }

  function marker(node) {
    if (node.matches('input[type="radio"], input[type="checkbox"]')) return String(node.checked);
    return node.getAttribute('aria-pressed') ?? node.getAttribute('aria-selected') ??
      node.getAttribute('aria-checked') ?? node.getAttribute('aria-current') ??
      (config.selected ? String(node.matches(config.selected)) : null);
  }

  function selected(node) {
    const value = marker(node);
    return value !== null && value !== 'false';
  }

  function visual(node) {
    const rect = box(node);
    if (!rect) return null;
    const style = getComputedStyle(node);
    const viewport = { width: innerWidth, height: innerHeight };
    const inView = rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= viewport.width + 1 &&
      rect.y + rect.height <= viewport.height + 1;
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    const visible = node.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    return {
      node: label(node), rect, viewport, inView, visible,
      hittable: node.contains(top), opacity: Number(style.opacity),
      transform: style.transform, color: style.color, background: style.backgroundColor,
      clip: style.clipPath,
      outline: style.outlineStyle, outlineWidth: style.outlineWidth,
    };
  }

  function controlVisual(node) {
    const input = visual(node);
    if (!node?.labels?.length || input.visible) return input;
    const labelVisual = [...node.labels].map(visual).find(candidate => candidate?.visible && candidate.hittable);
    return labelVisual ? { ...labelVisual, inputHitTarget: input } : input;
  }

  function capture(full = false) {
    const controls = Object.entries(config.controls).map(([name, css]) => ({ name, node: document.querySelector(css) }));
    const title = document.querySelector(config.title);
    const description = document.querySelector(config.description);
    const board = document.querySelector(config.board);
    const count = document.querySelector(config.count);
    const effects = config.effects ? [...document.querySelectorAll(config.effects)] : [];
    const animations = document.getAnimations().map(animation => {
      if (!keys.has(animation)) keys.set(animation, ++id);
      const { effect } = animation;
      const { target } = effect ?? {};
      if (!effect) return { id: keys.get(animation), playState: animation.playState };
      const timing = effect.getComputedTiming();
      const inScene = target !== null && [board, ...effects].some(node => node?.contains(target) || target?.contains(node));
      const entry = {
        id: keys.get(animation), target: label(target), playState: animation.playState,
        time: animation.currentTime === null ? null : round(Number(animation.currentTime)),
        duration: timing.duration, iterations: timing.iterations,
        progress: timing.progress, inScene,
      };
      if (full) entry.keyframes = effect.getKeyframes();
      return entry;
    });
    return {
      at: round(performance.now()), reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      title: title?.textContent.trim(), description: description?.textContent.trim(),
      count: count?.textContent.trim(), selection: controls.filter(({ node }) => node && selected(node)).map(({ name }) => name),
      controlMarkers: Object.fromEntries(controls.map(({ name, node }) => [name, node ? marker(node) : null])),
      focus: controls.find(({ node }) => node?.contains(document.activeElement))?.name ?? label(document.activeElement),
      layout: { width: innerWidth, htmlScroll: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, dpr: devicePixelRatio },
      titleVisual: visual(title), descriptionVisual: visual(description), board: visual(board),
      subject: config.subject ? visual(document.querySelector(config.subject)) : null,
      mark: config.mark ? visual(document.querySelector(config.mark)) : null,
      controls: Object.fromEntries(controls.map(({ name, node }) => [name, controlVisual(node)])),
      effectTotal: effects.length,
      effects: effects.slice(0, 24).map(visual), animations,
    };
  }

  function record() {
    frames.push(capture());
    frameRequest = requestAnimationFrame(record);
  }

  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) {
    addEventListener(type, event => {
      if (!event.isTrusted || !config) return;
      const control = Object.entries(config.controls).find(([, css]) => event.target.closest?.(css))?.[0];
      events.push({ type, at: round(event.timeStamp), control, pointerType: event.pointerType, key: event.key });
    }, true);
  }

  window.__iteration02 = {
    configure: value => { config = value; },
    capture,
    start: () => {
      events.length = 0;
      frames.length = 0;
      if (!frameRequest) frameRequest = requestAnimationFrame(record);
    },
    stop: () => {
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      return { frames, events };
    },
    events: () => events,
  };
}

function cssPath(node) {
  if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) return `#${CSS.escape(node.id)}`;
  const parts = [];
  for (let cursor = node; cursor; cursor = cursor.parentElement) {
    const index = cursor.parentElement ? [...cursor.parentElement.children].indexOf(cursor) + 1 : 1;
    parts.unshift(`${cursor.localName}:nth-child(${index})`);
  }
  return parts.join(' > ');
}

let browser;

async function open(environment = desktop, scenario = '') {
  const context = await browser.newContext(environment);
  const page = await context.newPage();
  await page.addInitScript(installCapture);
  page.on('pageerror', error => report.runtime.push({ scenario, type: 'exception', message: error.message }));
  page.on('console', message => {
    if (message.type() === 'error') report.runtime.push({ scenario, type: 'console error', message: message.text() });
  });
  page.on('requestfailed', request => report.runtime.push({ scenario, type: 'request failed', url: request.url(), message: request.failure()?.errorText }));
  page.on('response', response => {
    if (!response.ok()) report.runtime.push({ scenario, type: 'http error', url: response.url(), status: response.status() });
  });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    report.runtime.push({ scenario, type: 'external request', url: route.request().url() });
    return route.abort();
  });
  const response = await page.goto(origin, { waitUntil: 'load' });
  if (!response?.ok()) throw new Error(`Sample did not load (${response?.status()}).`);
  const controls = {};
  const paths = {};
  for (const name of names) {
    if (selectors.controls?.[name]) {
      controls[name] = page.locator(selectors.controls[name]);
    } else {
      const candidates = ['button', 'tab', 'radio'].map(role => page.getByRole(role, { name, exact: true }));
      for (const candidate of candidates) {
        if (await candidate.count() === 1) {
          controls[name] = candidate;
          break;
        }
      }
    }
    if (!controls[name]) throw new Error(`Missing unique control ${name}. Configure its CSS locator if it has a different accessible name.`);
    paths[name] = await controls[name].evaluate(cssPath);
  }
  await page.evaluate(config => window.__iteration02.configure(config), { ...selectors, controls: paths });
  await raf(page);
  return { context, page, controls };
}

function raf(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}

function state(page) {
  return page.evaluate(() => window.__iteration02.capture(true));
}

function start(page) {
  return page.evaluate(() => window.__iteration02.start());
}

function stop(page) {
  return page.evaluate(() => window.__iteration02.stop());
}

function trusted(page) {
  return page.evaluate(() => window.__iteration02.events());
}

async function point(control) {
  await control.scrollIntoViewIfNeeded();
  const rect = await control.boundingBox();
  if (!rect) throw new Error('Control has no pointer target.');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

async function mouse(page, control) {
  const location = await point(control);
  await page.mouse.click(location.x, location.y);
}

async function tap(page, control) {
  const location = await point(control);
  await page.touchscreen.tap(location.x, location.y);
}

async function tabTo(page, name) {
  for (let index = 0; index < 16; index++) {
    await page.keyboard.press('Tab');
    if ((await state(page)).focus === name) return true;
  }
  return false;
}

function active(state) {
  return state.animations.filter(animation => animation.playState === 'running' || animation.playState === 'pending');
}

function sceneActive(state) {
  return active(state).filter(animation => animation.inScene);
}

function quietWindow(frames, from, to) {
  const window = frames.filter(frame => frame.at >= from && frame.at <= to);
  return window.length >= 2 && window.every(frame => active(frame).length === 0);
}

function normalized(value) {
  return value?.replace(/\s+/g, ' ').trim();
}

function chapterIs(state, name, canonical) {
  return normalized(state.title)?.includes(name) && state.description?.length &&
    state.selection.length === 1 && state.selection[0] === name &&
    (!canonical || state.description === canonical.description && state.title === canonical.title);
}

function countIs(state, count) {
  return state.count?.normalize('NFKC').match(/\d+/g)?.map(Number).includes(count) ?? false;
}

function narrowFits(state) {
  return state.layout.width === 390 && state.layout.dpr === 2 && state.layout.htmlScroll <= 390 &&
    state.layout.bodyScroll <= 390 && Object.values(state.controls).every(control =>
      control.visible && control.hittable && control.rect.x >= 0 && control.rect.x + control.rect.width <= 390,
    );
}

function copyVisible(frame) {
  return [frame.titleVisual, frame.descriptionVisual].every(copy =>
    copy?.visible && copy.inView && copy.hittable && copy.opacity >= 0.9,
  );
}

function touchWasTrusted(events, control) {
  return events.some(event => event.type === 'pointerdown' && event.control === control && event.pointerType === 'touch');
}

async function shot(page, file, anchor = null, desired = null) {
  const before = await state(page);
  await page.screenshot({ path: resolve(output, `${file}.png`), animations: 'allow' });
  const after = await state(page);
  report.frames.push({ file: `${file}.png`, requestedOffsetMs: desired,
    sampling: anchor === null ? 'unanchored still' : 'wall-clock capture window',
    actualWindowMs: anchor === null ? null : [before.at - anchor, after.at - anchor].map(value => Math.round(value * 100) / 100),
    before, after,
  });
}

async function frameSeries(label, prepare, trigger) {
  const offsets = chapter ? [0, 65, 160, 500, 880] : [0, 65, 120, 175, 500, 880];
  for (const offset of offsets) {
    const session = await open(desktop, `${label}-${offset}`);
    const { page, context } = session;
    await prepare(session);
    await trigger(session);
    const lastClick = (await trusted(page)).findLast(event => event.type === 'click');
    if (!lastClick) throw new Error(`No browser click for frame ${label}-${offset}.`);
    const since = await page.evaluate(at => performance.now() - at, lastClick.at);
    if (offset > since) await delay(offset - since);
    await shot(page, `${label}-${offset}`, lastClick.at, offset);
    await context.close();
  }
}

async function seekScene(label, offset, prepare, trigger) {
  const session = await open(desktop, `${label}-fixed-${offset}`);
  const { page, context } = session;
  await prepare(session);
  await trigger(session);
  const click = (await trusted(page)).findLast(event => event.type === 'click');
  const animationCount = await page.evaluate(async offset => {
    const animations = document.getAnimations().filter(animation =>
      animation.effect?.getComputedTiming().iterations === 1,
    );
    for (const animation of animations) {
      animation.pause();
      animation.currentTime = offset;
    }
    await Promise.all(animations.map(animation => animation.ready));
    return animations.length;
  }, offset);
  if (animationCount && click) {
    await shot(page, `${label}-fixed-${offset}`, click.at, offset);
    const frame = report.frames.at(-1);
    frame.sampling = 'paused Web Animations timelines';
    frame.fixedTimeMs = offset;
    frame.animationTimesStayedFixed = frame.before.animations.every(before =>
      before.time === offset && frame.after.animations.some(after => after.id === before.id && after.time === offset),
    );
  }
  await context.close();
}

async function readFrames(label, prepare, trigger) {
  await frameSeries(label, prepare, trigger);
  if (selectors.seek) {
    for (const offset of chapter ? [0, 65] : [65, 120, 175]) {
      await seekScene(label, offset, prepare, trigger);
    }
  }
}

function checkSceneSettled(label) {
  const frames = [500, 880].map(offset => report.frames.find(frame => frame.file === `${label}-${offset}.png`));
  const samples = frames.flatMap(frame => [frame.before, frame.after]);
  check(`${caseId}.V.${label}.500–900ms静止`, samples.every(sample =>
    active(sample).length === 0 && sample.board?.transform === samples[0].board?.transform &&
    sample.subject?.transform === samples[0].subject?.transform,
  ), samples.map(({ board, subject, animations }) => ({ board, subject, animations })));
}

async function chapters() {
  const { page, context, controls } = await open(desktop, 'chapter input');
  const stable = { 纸面: await state(page) };
  await shot(page, 'chapter-initial');
  for (const name of ['走墨', '收版', '纸面']) {
    await mouse(page, controls[name]);
    await raf(page);
    stable[name] = await state(page);
    check(`03.I.鼠标.${name}`, chapterIs(stable[name], name), stable[name]);
    await delay(410);
  }
  check('03.R.章节说明独立', new Set(chapterNames.map(name => stable[name].description)).size === 3, chapterNames.map(name => stable[name].description));
  const keyFocused = await tabTo(page, '走墨');
  const keyboardFocus = await state(page);
  await shot(page, 'chapter-keyboard-focus');
  await page.keyboard.press('Enter');
  await delay(450);
  const keyResult = await state(page);
  check('03.I.Enter', keyFocused && chapterIs(keyResult, '走墨', stable.走墨), { keyboardFocus, keyResult });
  await mouse(page, controls.纸面);
  await delay(420);
  const points = await Promise.all(['走墨', '收版', '纸面'].map(name => point(controls[name])));
  await start(page);
  for (const [index, coordinate] of points.entries()) {
    if (index !== 0) await delay(49);
    await page.mouse.click(coordinate.x, coordinate.y);
  }
  await delay(915);
  const race = await stop(page);
  const clicks = race.events.filter(event => event.type === 'click');
  const intervals = clicks.slice(1).map((event, index) => Math.round((event.at - clicks[index].at) * 100) / 100);
  const finalClick = clicks.at(-1)?.at;
  const firstClick = clicks[0]?.at;
  const afterRace = race.frames.filter(frame => frame.at >= finalClick);
  const earlier = race.frames.filter(frame => frame.at >= firstClick && frame.at < finalClick);
  const firstAnimationIds = new Set(earlier.flatMap(frame => sceneActive(frame).map(animation => animation.id)));
  const oldReappears = afterRace.flatMap(frame => sceneActive(frame)).some(animation => firstAnimationIds.has(animation.id));
  report.observations.chapterRace = { ...race, intervals };
  check('03.I.连点输入窗口', clicks.map(event => event.control).join('/') === '走墨/收版/纸面' && intervals.every(ms => ms >= 30 && ms <= 80), intervals);
  check('03.I.连点标题说明和选择', afterRace.length > 0 && afterRace.every(frame => chapterIs(frame, '纸面', stable.纸面)), afterRace.slice(0, 3));
  check('03.V.旧动画不复现', !oldReappears, { earlierAnimationIds: [...firstAnimationIds], inspectedFrames: afterRace.length });
  check('03.V.连点首帧文字', afterRace.length > 0 && [...earlier, ...afterRace].every(copyVisible), { sampled: earlier.length + afterRace.length });
  check('03.V.500–900ms静止', quietWindow(race.frames, finalClick + 500, finalClick + 900), { lastClick: finalClick, sampled: afterRace.length });
  await shot(page, 'chapter-race-settled');
  await context.close();

  const phone = await open(mobile, 'chapter touch');
  await tap(phone.page, phone.controls.收版);
  await delay(450);
  const touchState = await state(phone.page);
  const touchEvents = await trusted(phone.page);
  check('03.I.390px触摸和操作边界', touchWasTrusted(touchEvents, '收版') && chapterIs(touchState, '收版', stable.收版) && narrowFits(touchState), { touchState, touchEvents });
  await shot(phone.page, 'chapter-mobile-touch');
  await phone.context.close();

  const reduced = await open({ ...desktop, reducedMotion: 'reduce' }, 'chapter loaded reduced');
  const reducedInitial = await state(reduced.page);
  await mouse(reduced.page, reduced.controls.走墨);
  await raf(reduced.page);
  const reducedNext = await state(reduced.page);
  check('03.M.初载减少动画', reducedInitial.reduced && reducedNext.reduced && chapterIs(reducedNext, '走墨', stable.走墨) &&
    active(reducedInitial).length === 0 && active(reducedNext).length === 0, { reducedInitial, reducedNext });
  await shot(reduced.page, 'chapter-reduced-loaded');
  await reduced.context.close();

  const dynamic = await open(desktop, 'chapter dynamically reduced');
  await mouse(dynamic.page, dynamic.controls.收版);
  await delay(45);
  const moving = await state(dynamic.page);
  await dynamic.page.emulateMedia({ reducedMotion: 'reduce' });
  await raf(dynamic.page);
  await raf(dynamic.page);
  const stopped = await state(dynamic.page);
  await shot(dynamic.page, 'chapter-reduced-midflight');
  await dynamic.page.emulateMedia({ reducedMotion: 'no-preference' });
  await delay(80);
  const restored = await state(dynamic.page);
  await mouse(dynamic.page, dynamic.controls.纸面);
  await raf(dynamic.page);
  const next = await state(dynamic.page);
  check('03.M.活跃时切换和恢复', moving.reduced === false && sceneActive(moving).length > 0 && stopped.reduced &&
    chapterIs(stopped, '收版', stable.收版) && active(stopped).length === 0 && active(restored).length === 0 &&
    chapterIs(restored, '收版', stable.收版) && chapterIs(next, '纸面', stable.纸面) && sceneActive(next).length > 0,
  { moving, stopped, restored, next });
  await dynamic.context.close();

  await readFrames('chapter-forward', async () => {}, async ({ page, controls }) => mouse(page, controls.走墨));
  await readFrames('chapter-reverse', async ({ page, controls }) => {
    await mouse(page, controls.走墨);
    await delay(520);
  }, async ({ page, controls }) => mouse(page, controls.纸面));
}

async function profiles() {
  const { page, context, controls } = await open(desktop, 'profile cumulative input');
  const initial = await state(page);
  check('04.R.印次初始为0', countIs(initial, 0), initial);
  await shot(page, 'profile-initial');
  await mouse(page, controls.克制);
  await delay(150);
  const restrained = await state(page);
  check('04.I.克制可选择并保留印次', restrained.selection.includes('克制') && countIs(restrained, 0), restrained);
  const snapshots = [];
  const switches = [];
  const switchAt = new Map([[3, '表现'], [6, '克制'], [9, '表现']]);
  let keyFocused = false;
  for (let index = 1; index <= 12; index++) {
    const profile = switchAt.get(index);
    if (index === 2) {
      keyFocused = await tabTo(page, '落版');
      await shot(page, 'profile-keyboard-focus');
      await page.keyboard.press('Enter');
    } else {
      await mouse(page, controls.落版);
    }
    await raf(page);
    const afterPress = await state(page);
    snapshots.push({ index, afterPress });
    if (profile) {
      await delay(30);
      const beforeSwitch = await state(page);
      await mouse(page, controls[profile]);
      const immediate = await state(page);
      await raf(page);
      const nextFrame = await state(page);
      await shot(page, `profile-change-${index}`);
      await delay(560);
      const settled = await state(page);
      switches.push({ index, profile, beforeSwitch, immediate, nextFrame, settled });
    } else {
      await delay(450);
    }
  }
  report.observations.profileCumulative = { snapshots, switches };
  check('04.I.累计12次且Enter实际提交', keyFocused && snapshots.every(({ index, afterPress }) => countIs(afterPress, index)),
    { focused: keyFocused, counts: snapshots.map(({ afterPress }) => afterPress.count) });
  check('04.I.换档焦点和印次', switches.every(({ index, profile, immediate, nextFrame, settled }) =>
    [immediate, nextFrame, settled].every(frame => countIs(frame, index) && frame.selection.includes(profile) && frame.focus === profile)),
  switches.map(({ index, profile, immediate, nextFrame, settled }) => ({ index, profile, immediate: immediate.focus, next: nextFrame.focus, settled: settled.focus })));
  check('04.V.活跃时换档停止旧动画', switches.every(({ beforeSwitch, immediate, nextFrame, settled }) => {
    const previous = new Set(sceneActive(beforeSwitch).map(animation => animation.id));
    return previous.size > 0 && [immediate, nextFrame, settled].every(frame =>
      sceneActive(frame).every(animation => !previous.has(animation.id)));
  }), switches.map(({ index, beforeSwitch, immediate, nextFrame, settled }) => ({ index,
    before: sceneActive(beforeSwitch), immediate: sceneActive(immediate), next: sceneActive(nextFrame), settled: sceneActive(settled),
  })));
  check('04.I.换档后下一次激活保留新选择', switches.every(({ index, profile }) => {
    const { afterPress } = snapshots[index];
    return afterPress.selection.includes(profile) && countIs(afterPress, index + 1) && sceneActive(afterPress).length > 0;
  }), switches.map(({ index, profile }) => ({ index, profile, followingPress: snapshots[index].afterPress })));
  await context.close();

  const phone = await open(mobile, 'profile touch');
  const oldProfile = (await state(phone.page)).selection.find(name => profileNames.includes(name));
  const otherProfile = oldProfile === '表现' ? '克制' : '表现';
  await tap(phone.page, phone.controls[otherProfile]);
  await tap(phone.page, phone.controls.落版);
  await delay(450);
  const touchState = await state(phone.page);
  const touchEvents = await trusted(phone.page);
  check('04.I.390px触摸换档和落版', touchWasTrusted(touchEvents, otherProfile) && touchWasTrusted(touchEvents, '落版') &&
    countIs(touchState, 1) && touchState.selection.includes(otherProfile) && narrowFits(touchState), { touchState, touchEvents });
  await shot(phone.page, 'profile-mobile-touch');
  await phone.context.close();

  const reduced = await open({ ...desktop, reducedMotion: 'reduce' }, 'profile loaded reduced');
  const reducedInitial = await state(reduced.page);
  await mouse(reduced.page, reduced.controls.表现);
  await mouse(reduced.page, reduced.controls.落版);
  await raf(reduced.page);
  const reducedNext = await state(reduced.page);
  check('04.M.初载减少动画', reducedInitial.reduced && countIs(reducedInitial, 0) && reducedNext.reduced &&
    countIs(reducedNext, 1) && active(reducedInitial).length === 0 && active(reducedNext).length === 0, { reducedInitial, reducedNext });
  await shot(reduced.page, 'profile-reduced-loaded');
  await reduced.context.close();

  const dynamic = await open(desktop, 'profile dynamically reduced');
  await mouse(dynamic.page, dynamic.controls.表现);
  await mouse(dynamic.page, dynamic.controls.落版);
  await delay(65);
  const moving = await state(dynamic.page);
  await dynamic.page.emulateMedia({ reducedMotion: 'reduce' });
  await raf(dynamic.page);
  await raf(dynamic.page);
  const stopped = await state(dynamic.page);
  await shot(dynamic.page, 'profile-reduced-midflight');
  await dynamic.page.emulateMedia({ reducedMotion: 'no-preference' });
  await delay(80);
  const restored = await state(dynamic.page);
  await mouse(dynamic.page, dynamic.controls.落版);
  await raf(dynamic.page);
  const next = await state(dynamic.page);
  check('04.M.活跃时切换和恢复', moving.reduced === false && countIs(moving, 1) && sceneActive(moving).length > 0 &&
    stopped.reduced && countIs(stopped, 1) && active(stopped).length === 0 && active(restored).length === 0 &&
    countIs(restored, 1) && countIs(next, 2) && sceneActive(next).length > 0, { moving, stopped, restored, next });
  await dynamic.context.close();

  for (const [index, profile] of profileNames.entries()) {
    const label = `profile-${index + 1}`;
    await readFrames(label, async ({ page, controls }) => {
      await mouse(page, controls[profile]);
      await delay(520);
    }, async ({ page, controls }) => mouse(page, controls.落版));
    checkSceneSettled(label);
  }
}

try {
  const { chromium } = await import(pathToFileURL(resolve(args.playwright)));
  browser = await chromium.launch({ executablePath: args.chromium ? resolve(args.chromium) : undefined, headless: true });
  report.browser = browser.version();
  report.started = new Date().toISOString();
  const begun = performance.now();
  if (chapter) await chapters();
  else await profiles();
  report.elapsedMs = Math.round(performance.now() - begun);
  check(`${caseId}.R.无运行错误和外部依赖`, report.runtime.length === 0, report.runtime);
} catch (error) {
  check(`${caseId}.evaluator`, false, { message: error.message, stack: error.stack });
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

const failed = report.checks.filter(check => check.status === 'fail').map(check => check.id);
console.log(JSON.stringify({ case: caseId, passed: report.checks.length - failed.length, failed, frames: report.frames.length, output }));
process.exitCode = failed.length ? 1 : 0;
