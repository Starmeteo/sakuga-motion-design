import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const playwright = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : 'playwright';
const { chromium } = await import(playwright);
const root = fileURLToPath(new URL('../skills/sakuga-motion-design/assets/web/', import.meta.url));
const output = resolve(process.argv[2] || 'docs/evidence/demo');
await mkdir(output, { recursive: true });

const formats = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    const format = formats[extname(file)];
    if (!format || !file.startsWith(resolve(root) + sep)) throw new Error('File unavailable');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': format + '; charset=utf-8' }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveListen, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolveListen);
});
const url = 'http://127.0.0.1:' + server.address().port;
const results = { browser: null, live: {}, stepped: {}, errors: [] };
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
let browser;

async function open(options) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', (error) => results.errors.push(String(error)));
  page.on('response', (response) => {
    if (response.status() >= 400) results.errors.push(response.url() + ' ' + response.status());
  });
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.sakugaDemo));
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

const state = (page) => page.evaluate(() => window.sakugaDemo.state());
const pause = (page, seed) => page.evaluate((value) => window.sakugaDemo.pause(value), seed);
const step = (page, ms) => page.evaluate((value) => window.sakugaDemo.step(value), ms);
const click = (page, name, value) => page.locator(value === undefined ? `[${name}]` : `[${name}="${value}"]`).click();
const pressed = async (page, name, value) => assert.equal(
  await page.locator(`[${name}="${value}"]`).getAttribute('aria-pressed'), 'true',
);
const screenshot = (page, name, selector) => page.locator(selector).screenshot({ path: join(output, name + '.png') });

async function pixels(page) {
  return page.locator('canvas[data-fx]').evaluateAll((canvases) => Object.fromEntries(canvases.map((canvas) => {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let drawn = 0;
    for (let i = 3; i < data.length; i += 4) drawn += data[i] > 0;
    return [canvas.dataset.fx, drawn];
  })));
}

async function chapterInkPixels(page) {
  return page.locator('[data-fx="chapter"]').evaluate((canvas) => {
    const hex = getComputedStyle(canvas).getPropertyValue('--ink').trim();
    const [r, g, b] = hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16));
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    let hits = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] === r && data[i + 1] === g && data[i + 2] === b && data[i + 3] === 255) hits++;
    }
    return { hex, hits };
  });
}

async function frames(preset, action, selector, timeline, seed = 33713, save = true) {
  const { context, page } = await open({ viewport: { width: 1200, height: 900 }, reducedMotion: 'no-preference' });
  try {
    await click(page, 'data-preset', preset);
    await pause(page, seed);
    await page.locator(selector).scrollIntoViewIfNeeded();
    const captures = [];
    let elapsed = 0;
    for (const [time, input] of timeline) {
      await step(page, time - elapsed);
      elapsed = time;
      await input?.(page);
      const key = `${preset}-${action}-${String(time).padStart(3, '0')}`;
      const image = save
        ? await screenshot(page, key, selector)
        : await page.locator(selector).screenshot();
      captures.push({
        time, hash: hash(image), pixels: await pixels(page), chapterInk: await chapterInkPixels(page), state: await state(page),
      });
    }
    return captures;
  } finally {
    await context.close();
  }
}

try {
  browser = await chromium.launch({ executablePath: process.env.SAKUGA_CHROMIUM });
  results.browser = browser.version();
  const { context, page } = await open({ viewport: { width: 1360, height: 920 }, reducedMotion: 'no-preference' });
  await page.screenshot({ path: join(output, 'desktop-rest.png'), fullPage: true });
  await click(page, 'data-preset', 'expressive');
  await page.locator('[data-confirm]').focus();
  await page.keyboard.press('Enter');
  assert.match(await page.locator('[data-count]').innerText(), /\b1\b/);
  await page.keyboard.press('Space');
  assert.match(await page.locator('[data-count]').innerText(), /\b2\b/);
  const confirm = await page.locator('[data-confirm]').boundingBox();
  await page.mouse.move(confirm.x + confirm.width / 2, confirm.y + confirm.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5);
  await page.mouse.up();
  assert.match(await page.locator('[data-count]').innerText(), /\b2\b/);
  await click(page, 'data-confirm');
  assert.match(await page.locator('[data-count]').innerText(), /\b3\b/);
  results.live.pressAfterKeyboardMouseAndCancel = await state(page);
  await screenshot(page, 'live-press', '[data-impression]');

  const art = page.locator('[data-artwork]');
  await art.focus();
  assert.equal(await art.getAttribute('role'), 'slider');
  await page.keyboard.press('ArrowLeft');
  await pressed(page, 'data-place', 'left');
  assert.equal(await art.getAttribute('aria-valuenow'), '1');
  assert.match(await art.getAttribute('aria-valuetext'), /^left$/i);
  await page.keyboard.press('End');
  await pressed(page, 'data-place', 'right');
  assert.equal(await art.getAttribute('aria-valuenow'), '3');
  await click(page, 'data-place', 'center');
  await pressed(page, 'data-place', 'center');
  const board = await page.locator('[data-dragboard]').boundingBox();
  assert.ok(board && board.width > 180);
  async function drag(from, to, delay) {
    const start = await art.boundingBox();
    const cx = start.x + start.width / 2;
    const cy = start.y + start.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let n = 1; n <= 10; n++) {
      await page.mouse.move(cx + (to - from) * board.width * n / 10, cy);
      if (delay) await sleep(delay);
    }
    const sample = { state: await state(page), pixels: await pixels(page) };
    if (delay === 0) await screenshot(page, 'live-fast-drag', '[data-dragboard]');
    await page.mouse.up();
    return sample;
  }
  await sleep(700);
  results.live.slow = await drag(.5, .82, 95);
  await pressed(page, 'data-place', 'right');
  await sleep(750);
  results.live.fast = await drag(.82, .13, 0);
  await pressed(page, 'data-place', 'left');
  assert.ok(results.live.fast.pixels.drag > results.live.slow.pixels.drag, 'fast input must leave a stronger trail');
  assert.ok(results.live.fast.state.artworkStretch > results.live.slow.state.artworkStretch);
  assert.equal(results.live.fast.state.lastDirection, -1);
  assert.equal(results.live.fast.state.effects.last.vx > 0, true, 'trail must oppose leftward motion');
  await sleep(720);
  const toCancel = await art.boundingBox();
  await page.mouse.move(toCancel.x + toCancel.width / 2, toCancel.y + toCancel.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width * .72, toCancel.y + toCancel.height / 2);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await pressed(page, 'data-place', 'left');
  assert.ok(!(await state(page)).dragging, 'cancel must release the gesture');
  assert.equal((await pixels(page)).drag, 0);

  await click(page, 'data-place', 'center');
  await sleep(550);
  const toHold = await art.boundingBox();
  await page.mouse.move(toHold.x + toHold.width / 2, toHold.y + toHold.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width * .8, toHold.y + toHold.height / 2);
  await sleep(300);
  const earlySlashes = (await state(page)).effects.emitted['drag:slash'] ?? 0;
  await page.mouse.up();
  const afterHold = await state(page);
  await pressed(page, 'data-place', 'right');
  assert.equal(afterHold.effects.emitted['drag:slash'] ?? 0, earlySlashes);
  assert.ok(Math.abs(afterHold.releaseSpeed) < .2);
  results.live.heldRelease = afterHold;

  await click(page, 'data-chapter', 'flight');
  await pressed(page, 'data-chapter', 'flight');
  await click(page, 'data-chapter', 'arrival');
  await click(page, 'data-chapter', 'pressure');
  await pressed(page, 'data-chapter', 'pressure');
  assert.equal(await page.locator('[data-chapter-title]').innerText(), 'Pressure');
  results.live.afterChapterReplacements = await state(page);
  assert.ok(results.live.afterChapterReplacements.effects.active <= 28);
  const layoutWidth = results.live.afterChapterReplacements.layout.chapter.width;
  await page.setViewportSize({ width: 750, height: 820 });
  await page.waitForFunction((last) => window.sakugaDemo.state().layout.chapter.width !== last, layoutWidth);
  assert.deepEqual(await pixels(page), { chapter: 0, drag: 0, impact: 0 });
  results.live.resized = await state(page);
  await click(page, 'data-chapter', 'flight');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await click(page, 'data-chapter', 'arrival');
  await click(page, 'data-confirm');
  await click(page, 'data-place', 'right');
  await pressed(page, 'data-place', 'right');
  await pressed(page, 'data-chapter', 'arrival');
  assert.match(await page.locator('[data-count]').innerText(), /\b4\b/);
  assert.deepEqual(await pixels(page), { chapter: 0, drag: 0, impact: 0 });
  assert.deepEqual(await page.locator('canvas').evaluateAll((nodes) =>
    nodes.map((node) => getComputedStyle(node).visibility)), ['hidden', 'hidden', 'hidden']);
  results.live.reduced = await state(page);
  assert.equal(results.live.reduced.pressScale, 1);
  assert.equal(results.live.reduced.chapterOffset, 0);
  assert.equal(results.live.reduced.artworkStretch, 1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await sleep(150);
  assert.deepEqual(await pixels(page), { chapter: 0, drag: 0, impact: 0 });
  await click(page, 'data-chapter', 'flight');
  await sleep(125);
  assert.ok((await pixels(page)).chapter > 0, 'new input after restored preference must draw');
  await page.evaluate(() => window.sakugaDemo.destroy());
  assert.deepEqual(await pixels(page), { chapter: 0, drag: 0, impact: 0 });
  await click(page, 'data-confirm');
  results.live.destroyed = await state(page);
  assert.equal(results.live.destroyed.running, false);
  assert.equal(results.live.destroyed.destroyed, true);
  assert.equal(results.live.destroyed.registrations, 4, 'destroy must detach listeners');
  await context.close();

  const reducedStart = await open({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  await click(reducedStart.page, 'data-preset', 'expressive');
  await click(reducedStart.page, 'data-chapter', 'flight');
  await click(reducedStart.page, 'data-confirm');
  await click(reducedStart.page, 'data-place', 'left');
  results.live.reducedAtLoad = await state(reducedStart.page);
  assert.equal(results.live.reducedAtLoad.reduced, true);
  assert.equal(results.live.reducedAtLoad.chapter, 'flight');
  assert.equal(results.live.reducedAtLoad.registrations, 1);
  assert.equal(results.live.reducedAtLoad.placement, 'left');
  assert.deepEqual(await pixels(reducedStart.page), { chapter: 0, drag: 0, impact: 0 });
  await reducedStart.context.close();

  const mobile = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = mobile.page;
  assert.ok(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await m.locator('[data-preset="expressive"]').tap();
  await m.locator('[data-chapter="flight"]').tap();
  await m.locator('[data-place="right"]').tap();
  await pressed(m, 'data-place', 'right');
  await m.locator('[data-artwork]').scrollIntoViewIfNeeded();
  await sleep(450);
  const cdp = await mobile.context.newCDPSession(m);
  const touchArt = await m.locator('[data-artwork]').boundingBox();
  const touchBoard = await m.locator('[data-dragboard]').boundingBox();
  const x0 = touchArt.x + touchArt.width / 2;
  const y0 = touchArt.y + touchArt.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let n = 1; n <= 7; n++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x0 - touchBoard.width * .61 * n / 7, y: y0 }],
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await pressed(m, 'data-place', 'left');
  await sleep(520);
  const cancelArt = await m.locator('[data-artwork]').boundingBox();
  const cancelX = cancelArt.x + cancelArt.width / 2;
  const cancelY = cancelArt.y + cancelArt.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cancelX, y: cancelY }] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: cancelX + touchBoard.width * .4, y: cancelY }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.ok(!(await state(m)).dragging);
  await pressed(m, 'data-place', 'left');
  await m.locator('[data-confirm]').tap();
  assert.match(await m.locator('[data-count]').innerText(), /\b1\b/);
  await sleep(700);
  await m.screenshot({ path: join(output, 'touch-390.png'), fullPage: true });
  results.live.touch390 = await state(m);
  await mobile.context.close();

  const chapter = [[0], [16, (p) => click(p, 'data-chapter', 'flight')], [75], [140], [230], [380], [560], [850]];
  const impact = [[0], [16, (p) => p.locator('[data-confirm]').hover().then(() => p.mouse.down())],
    [94], [145, (p) => p.mouse.up()], [184], [270], [415], [1000]];
  let gesture;
  const beginDrag = async (p) => {
    const bounds = await p.locator('[data-dragboard]').boundingBox();
    gesture = { y: bounds.y + bounds.height / 2, x: bounds.x, w: bounds.width };
    await p.mouse.move(gesture.x + gesture.w * .5, gesture.y);
    await p.mouse.down();
  };
  const moveDrag = (fraction) => (p) => p.mouse.move(gesture.x + gesture.w * fraction, gesture.y);
  const dragTimeline = [[0], [16, beginDrag], [39, moveDrag(.57)], [66, moveDrag(.66)], [91, moveDrag(.8)],
    [111, (p) => p.mouse.up()], [157], [320], [750]];
  for (const preset of ['restrained', 'expressive']) {
    results.stepped[preset] = await frames(preset, 'reveal', '[data-chapter-panel]', chapter);
  }
  const restrainedInk = results.stepped.restrained[2].chapterInk;
  const expressiveInk = results.stepped.expressive[2].chapterInk;
  assert.notEqual(restrainedInk.hex, expressiveInk.hex);
  assert.ok(restrainedInk.hits > 0 && expressiveInk.hits > 0, 'CSS ink must map to actual canvas color');
  results.stepped.impact = await frames('expressive', 'impact', '[data-impression]', impact);
  results.stepped.drag = await frames('expressive', 'drag', '[data-dragboard]', dragTimeline);
  assert.ok(results.stepped.drag.some((frame) => frame.state.effects.emitted['drag:slash'] > 0));
  const first = results.stepped.expressive;
  const repeat = await frames('expressive', 'reveal', '[data-chapter-panel]', chapter, 33713, false);
  const changed = await frames('expressive', 'reveal', '[data-chapter-panel]', chapter, 14431, false);
  assert.deepEqual(first.map((frame) => frame.hash), repeat.map((frame) => frame.hash), 'same seed must reproduce frames');
  assert.ok(first.some((frame, n) => frame.hash !== changed[n].hash), 'alternate seed must affect visual details');
  assert.ok(Math.max(...first.map((frame) => frame.pixels.chapter))
    > Math.max(...results.stepped.restrained.map((frame) => frame.pixels.chapter)));
  results.stepped.seed = { sameSeed: true, alternateSeedDiffers: true };
  assert.deepEqual(results.errors, []);
} finally {
  await browser?.close();
  server.close();
  await writeFile(join(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
}
