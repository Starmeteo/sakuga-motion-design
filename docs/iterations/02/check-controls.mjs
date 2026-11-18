import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const [testCase, source, destination, handleSelector] = process.argv.slice(2);
assert.ok(['01', '02'].includes(testCase) && source && destination,
  'Usage: node check-controls.mjs 01|02 PROJECT_DIR OUTPUT_DIR [drag-handle-selector]');
const input = resolve(source);
const output = resolve(destination);
const playwright = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : 'playwright';
const { chromium } = await import(playwright);
const browser = await chromium.launch({ executablePath: process.env.SAKUGA_CHROMIUM });
await mkdir(output, { recursive: true });

const report = { case: testCase, browser: browser.version(), checks: {}, measurements: {}, frames: [], errors: [], outsideRequests: [] };
const desktop = { viewport: { width: 1360, height: 920 }, deviceScaleFactor: 1 };
const touch = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const origin = 'http://test.local';
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml' };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function trial(label, options, run) {
  const context = await browser.newContext({ ...desktop, ...options });
  try {
    await context.route('**/*', async (route) => {
      const target = new URL(route.request().url());
      if (target.origin !== origin) {
        report.outsideRequests.push(target.origin);
        return route.abort();
      }
      const file = resolve(input, '.' + decodeURIComponent(target.pathname));
      if (!file.startsWith(input + sep)) return route.abort();
      try {
        const body = await readFile(file);
        return route.fulfill({ contentType: mime[extname(file)] ?? 'application/octet-stream', body });
      } catch {
        return route.fulfill({ status: 404, body: '' });
      }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(2500);
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(origin + '/index.html');
    await page.evaluate(() => document.fonts.ready);
    await run(page, context);
    report.checks[label] = { pass: true };
  } catch (error) {
    report.checks[label] = { pass: false, reason: error.message };
  } finally {
    await context.close();
  }
}

const exactButton = (page, name) => page.getByRole('button', { name, exact: true })
  .or(page.getByRole('switch', { name, exact: true }))
  .or(page.getByRole('checkbox', { name, exact: true }))
  .or(page.getByRole('radio', { name, exact: true }));
const mark = (page) => exactButton(page, '标记校样');
const place = (page, name) => exactButton(page, name);
const handle = (page) => handleSelector ? page.locator(handleSelector) : page.getByRole('slider');
const stateNodes = (page, name) => page.getByText(name, { exact: true }).first();
const rect = async (locator) => {
  const bounds = await locator.boundingBox();
  assert.ok(bounds, 'visible hit target required');
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, bounds };
};

async function snap(page, name, method = 'natural clock') {
  await page.screenshot({ path: join(output, name + '.png'), timeout: 4000 });
  report.frames.push({ name, method });
}

async function stable(page) {
  const active = await page.evaluate(() => document.getAnimations()
    .filter((item) => item.playState === 'running' || item.pending)
    .map((item) => ({
      type: item.constructor.name,
      target: item.effect?.target?.className,
      property: item.transitionProperty,
    })));
  assert.deepEqual(active, [], 'active CSS/WAAPI animations');
}

async function fixedFrames(page, label, times, naturalStart) {
  const affected = await page.evaluate(async () => {
    window.__iterationAnimations = document.getAnimations();
    for (const animation of window.__iterationAnimations) animation.pause();
    await Promise.allSettled(window.__iterationAnimations.map((animation) => animation.ready));
    return window.__iterationAnimations.length;
  });
  if (!affected) {
    await snap(page, label + '-live', `natural-clock sample ~${Date.now() - naturalStart} ms after input`);
    return;
  }
  for (const time of times) {
    await page.evaluate((ms) => window.__iterationAnimations.forEach((activity) => { activity.currentTime = ms; }), time);
    await snap(page, `${label}-${time}`, `CSS/WAAPI currentTime ${time} ms for ${affected} animations`);
  }
}

async function stateMark(page, isOn) {
  const target = mark(page);
  const exposed = await target.getAttribute('aria-pressed') ?? await target.getAttribute('aria-checked');
  if (exposed !== null) assert.equal(exposed, String(isOn));
  assert.ok(await stateNodes(page, isOn ? '已校' : '待校').isVisible(), 'visible committed mark state');
}

async function outsideRelease(page, button) {
  const start = await rect(button);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(3, 3, { steps: 4 });
  await page.mouse.up();
}

async function narrow(page) {
  const { width, scrollWidth } = await page.evaluate(() => ({
    width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(width, 390, 'mobile viewport meta missing');
  assert.ok(scrollWidth <= width, 'horizontal overflow');
}

async function tabTo(page, control) {
  for (let n = 0; n < 12; n++) {
    await page.keyboard.press('Tab');
    if (await control.evaluate((node) => node.matches(':focus'))) return;
  }
  assert.fail('control could not be reached with Tab');
}

async function checkMark() {
  await trial('input-and-repeat', {}, async (page) => {
    const control = mark(page);
    await stateMark(page, false);
    await tabTo(page, control);
    await page.keyboard.press('Enter');
    await stateMark(page, true);
    await control.click();
    await stateMark(page, false);
    await page.keyboard.press('Space');
    await stateMark(page, true);
    await outsideRelease(page, control);
    await stateMark(page, true);
    for (let n = 0; n < 3; n++) {
      await control.click();
      await stateMark(page, n === 1);
    }
    await sleep(700);
    await stateMark(page, false);
    await stable(page);
  });
  await trial('steady-touch', touch, async (page) => {
    await narrow(page);
    await mark(page).tap();
    await stateMark(page, true);
    await snap(page, 'mobile-touch');
  });
  await trial('preference-during-hold', {}, async (page) => {
    const target = await rect(mark(page));
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await sleep(90);
    await stateMark(page, false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sleep(50);
    await snap(page, 'reduced-held');
    await stable(page);
    await page.mouse.up();
    await stateMark(page, true);
    await stable(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await sleep(70);
    await stable(page);
  });
  await trial('preference-during-committed-motion', {}, async (page) => {
    await mark(page).click();
    await stateMark(page, true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sleep(50);
    await stable(page);
    await stateMark(page, true);
    await snap(page, 'reduced-after-commit');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await sleep(70);
    await stable(page);
    await mark(page).click();
    await stateMark(page, false);
  });
  await trial('steady-touch-reduced-at-load', { ...touch, reducedMotion: 'reduce' }, async (page) => {
    await narrow(page);
    await mark(page).tap();
    await stateMark(page, true);
    await stable(page);
    await snap(page, 'mobile-reduced');
  });
  await trial('motion-frames', {}, async (page) => {
    await snap(page, 'idle');
    const target = await rect(mark(page));
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await sleep(92);
    await stateMark(page, false);
    await snap(page, 'held', 'natural clock, held at least 92 ms');
    await page.mouse.up();
    const release = Date.now();
    await stateMark(page, true);
    await fixedFrames(page, 'commit', [0, 65, 170, 500], release);
    await page.reload();
    await mark(page).click();
    await sleep(720);
    await mark(page).click();
    await fixedFrames(page, 'undo', [65, 500], Date.now());
  });
}

async function statePlace(page, expected) {
  const button = place(page, expected);
  const pressed = await button.getAttribute('aria-pressed') ?? await button.getAttribute('aria-checked');
  if (pressed !== null) return assert.equal(pressed, 'true', `selection should be ${expected}`);
  const text = await handle(page).getAttribute('aria-valuetext');
  if (text) return assert.ok(text.includes(expected), `position ${text}, expected ${expected}`);
  const status = await page.getByRole('status').allTextContents();
  assert.ok(status.some((value) => value.includes(expected)), `no readable current slot ${expected}`);
}

async function placeGeometry(page) {
  const result = {};
  for (const id of ['上', '下', '中']) {
    await place(page, id).click();
    await sleep(450);
    result[id] = await rect(handle(page));
  }
  assert.ok(result['上'].y < result['中'].y && result['中'].y < result['下'].y, 'stable vertical slots');
  return result;
}

async function drag(page, from, to, steps, dwell = 0) {
  const begin = await rect(handle(page));
  await page.mouse.move(begin.x, begin.y);
  await page.mouse.down();
  for (let n = 1; n <= steps; n++) {
    await page.mouse.move(begin.x, begin.y + (to.y - from.y) * n / steps);
    if (dwell && n < steps) await sleep(dwell);
  }
  return begin;
}

async function instantPose(page) {
  return handle(page).evaluate((node) => {
    const sample = (element) => {
      const box = element.getBoundingClientRect();
      return { y: Math.round(box.y * 10) / 10, height: Math.round(box.height * 10) / 10, transform: getComputedStyle(element).transform };
    };
    return [node, ...[...node.querySelectorAll('*')].slice(0, 12)].map(sample);
  });
}

async function checkDrag() {
  await trial('pointer-speed-direction-and-cancel', {}, async (page) => {
    await statePlace(page, '中');
    const places = await placeGeometry(page);
    const motion = {};
    for (const [id, label, steps, dwell] of [['上', 'slow-up', 12, 56], ['下', 'fast-down', 5, 0]]) {
      await drag(page, places['中'], places[id], steps, dwell);
      motion[label] = await instantPose(page);
      await snap(page, label, `natural pointer, ${steps} samples, ${dwell} ms added interval`);
      await page.mouse.up();
      await statePlace(page, id);
      await place(page, '中').click();
      await sleep(500);
    }
    const begin = await drag(page, places['中'], places['上'], 4);
    await page.mouse.move(begin.x, places['下'].y, { steps: 4 });
    motion.reversed = await instantPose(page);
    await snap(page, 'reverse-down');
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await statePlace(page, '中');
    await sleep(500);
    await drag(page, places['中'], places['下'], 4);
    await sleep(350);
    motion.held = await instantPose(page);
    await page.mouse.up();
    await statePlace(page, '下');
    await snap(page, 'held-350-release');
    await sleep(650);
    await snap(page, 'settled');
    report.measurements.pointer = motion;
  });
  await trial('keyboard-and-click', {}, async (page) => {
    await statePlace(page, '中');
    await tabTo(page, handle(page));
    await page.keyboard.press('ArrowUp');
    await statePlace(page, '上');
    await page.keyboard.press('ArrowDown');
    await statePlace(page, '中');
    await place(page, '下').click();
    await statePlace(page, '下');
  });
  await trial('touch-and-touchcancel', touch, async (page, context) => {
    await narrow(page);
    await place(page, '上').tap();
    await statePlace(page, '上');
    const places = await placeGeometry(page);
    await handle(page).scrollIntoViewIfNeeded();
    const cdp = await context.newCDPSession(page);
    const move = async (direction, end) => {
      const start = await rect(handle(page));
      const shift = (places[direction].y - places['中'].y);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
      for (let n = 1; n <= 6; n++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y + shift * n / 6 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
    };
    await move('上', 'touchCancel');
    await statePlace(page, '中');
    await sleep(450);
    await move('下', 'touchEnd');
    await statePlace(page, '下');
    await snap(page, 'narrow-touch');
  });
  await trial('reduced-at-load-and-dynamic', { reducedMotion: 'reduce' }, async (page) => {
    await place(page, '上').click();
    await statePlace(page, '上');
    await stable(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await place(page, '中').click();
    await sleep(500);
    const begin = await rect(handle(page));
    await page.mouse.move(begin.x, begin.y);
    await page.mouse.down();
    await page.mouse.move(begin.x, begin.y + 65, { steps: 3 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sleep(50);
    await stable(page);
    await page.mouse.up();
    await place(page, '下').click();
    await statePlace(page, '下');
    await stable(page);
    await snap(page, 'reduced-during-drag');
  });
}

try {
  await (testCase === '01' ? checkMark() : checkDrag());
} finally {
  await browser.close();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ checks: report.checks, errors: report.errors, outsideRequests: report.outsideRequests }));
if (Object.values(report.checks).some((check) => !check.pass) || report.errors.length || report.outsideRequests.length) {
  process.exitCode = 1;
}
