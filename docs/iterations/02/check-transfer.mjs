import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [source, evidence] = process.argv.slice(2);
assert.ok(source && evidence, 'Usage: node check-transfer.mjs INDEX_HTML EVIDENCE_DIR');
const url = pathToFileURL(resolve(source)).href;
const output = resolve(evidence);
const playwright = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : 'playwright';
const { chromium } = await import(playwright);
const browser = await chromium.launch({ executablePath: process.env.SAKUGA_CHROMIUM });
await mkdir(output, { recursive: true });
const report = { browser: browser.version(), checks: {}, frames: [], errors: [] };
const startOrder = '101,102,103,104,105';
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const raf = (page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
const control = (p, id) => p.locator(`#work-orders > .order[data-order="${id}"] button`);

async function trial(name, options, fn) {
  const context = await browser.newContext({ viewport: { width: 900, height: 700 }, ...options });
  try {
    const page = await context.newPage();
    page.on('pageerror', (error) => report.errors.push(error.message));
    await page.goto(url);
    await fn(page);
    report.checks[name] = { pass: true };
  } catch (error) {
    report.checks[name] = { pass: false, reason: error.message };
  } finally {
    await context.close();
  }
}

async function read(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('#work-orders > .order')];
    return {
      order: rows.map((row) => row.dataset.order).join(','),
      priority: rows.filter((row) => row.querySelector('button').getAttribute('aria-pressed') === 'true')
        .map((row) => row.dataset.order).join(','),
      focus: document.activeElement.closest('.order')?.dataset.order ?? null,
      focusVisible: document.activeElement.matches(':focus-visible'),
      status: document.querySelector('[role=status]').textContent.trim(),
      positions: Object.fromEntries(rows.map((row) => [row.dataset.order, Math.round(row.getBoundingClientRect().top * 10) / 10])),
      animations: document.getAnimations().filter((animation) => animation.playState === 'running' || animation.pending).length,
    };
  });
}

async function checkState(page, order, priority = '') {
  const snapshot = await read(page);
  assert.equal(snapshot.order, order);
  assert.equal(snapshot.priority, priority);
  assert.ok(priority ? snapshot.status.includes(priority) : snapshot.status.length > 0);
  return snapshot;
}

async function photo(page, label, start = null, requested = null) {
  const before = start === null ? null : Date.now() - start;
  await page.screenshot({ path: join(output, label + '.png') });
  const after = start === null ? null : Date.now() - start;
  report.frames.push({ file: label + '.png', requested, window: before === null ? null : [before, after], state: await read(page) });
}

try {
  await trial('business', {}, async (page) => {
    await checkState(page, startOrder);
    for (const [id, order, priority] of [
      ['104', '104,101,102,103,105', '104'],
      ['103', '103,101,102,104,105', '103'],
      ['103', startOrder, ''],
      ['101', startOrder, '101'],
    ]) {
      await control(page, id).click();
      await raf(page);
      await checkState(page, order, priority);
    }
  });
  await trial('keyboard-and-focus', {}, async (page) => {
    assert.equal(await page.locator('#work-orders button').count(), 5);
    for (let n = 0; n < 4; n++) await page.keyboard.press('Tab');
    assert.equal((await read(page)).focus, '104');
    await page.keyboard.press('Enter');
    const entered = await checkState(page, '104,101,102,103,105', '104');
    assert.equal(entered.focus, '104');
    assert.ok(entered.focusVisible);
    await page.keyboard.press('Space');
    assert.equal((await checkState(page, startOrder)).focus, '104');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    assert.equal((await read(page)).focus, '101');
  });
  await trial('direction-samples', {}, async (page) => {
    const idle = await checkState(page, startOrder);
    await photo(page, 'idle');
    for (const [label, order, priority] of [
      ['advance', '104,101,102,103,105', '104'],
      ['return', startOrder, ''],
    ]) {
      const first = await control(page, '104').boundingBox();
      const onset = Date.now();
      await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
      await checkState(page, order, priority);
      await photo(page, label + '-start', onset, 0);
      await sleep(Math.max(0, onset + 115 - Date.now()));
      await photo(page, label + '-mid', onset, 115);
      await sleep(Math.max(0, onset + 740 - Date.now()));
      await photo(page, label + '-end', onset, 740);
      const end = await read(page);
      assert.equal(end.animations, 0);
      assert.equal(end.positions['105'], idle.positions['105']);
    }
  });
  await trial('rapid-70ms', {}, async (page) => {
    const data = await page.evaluate(async () => {
      const actions = [
        ['104', '104', '104,101,102,103,105'],
        ['102', '102', '102,101,103,104,105'],
        ['105', '105', '105,101,102,103,104'],
        ['105', '', '101,102,103,104,105'],
      ];
      const now = () => performance.now();
      const delay = (ms) => new Promise((done) => setTimeout(done, ms));
      const read = () => {
        const rows = [...document.querySelectorAll('#work-orders > .order')];
        return [rows.filter((row) => row.querySelector('button').getAttribute('aria-pressed') === 'true')
          .map((row) => row.dataset.order).join(','), rows.map((row) => row.dataset.order).join(',')];
      };
      const times = [];
      const started = now();
      for (const [index, [id, priority, order]] of actions.entries()) {
        if (index) await delay(Math.max(0, started + index * 70 - now()));
        times.push(now() - started);
        document.querySelector(`.order[data-order="${id}"] button`).click();
        const immediate = read();
        await new Promise((done) => requestAnimationFrame(done));
        if (![immediate, read()].some((sample) => sample[0] === priority && sample[1] === order)) {
          throw new Error('Rapid action state ' + id);
        }
      }
      await delay(900);
      return { times, end: read() };
    });
    assert.deepEqual(data.end, ['', startOrder]);
    assert.equal((await checkState(page, startOrder)).animations, 0);
    await control(page, '102').click();
    await checkState(page, '102,101,103,104,105', '102');
    report.rapidTimesMs = data.times;
  });
  await trial('touch-360', { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, async (page) => {
    await control(page, '105').tap();
    await checkState(page, '105,101,102,103,104', '105');
    await control(page, '105').tap();
    await checkState(page, startOrder);
    await sleep(740);
    const geometry = await page.evaluate(() => ({
      withNoOverflow: innerWidth === 360 && document.documentElement.scrollWidth <= 360,
      controlsFit: [...document.querySelectorAll('.order button')].every((button) => {
        const rect = button.getBoundingClientRect();
        return !button.disabled && rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth;
      }),
    }));
    assert.deepEqual(geometry, { withNoOverflow: true, controlsFit: true });
    await photo(page, 'phone');
  });
  await trial('reduced-initial-and-dynamic', { reducedMotion: 'reduce' }, async (page) => {
    await control(page, '104').click();
    await raf(page);
    assert.equal((await checkState(page, '104,101,102,103,105', '104')).animations, 0);
    await control(page, '104').click();
    await checkState(page, startOrder);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await sleep(70);
    assert.equal((await read(page)).animations, 0);
    await control(page, '104').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await raf(page);
    await raf(page);
    const final = await checkState(page, '104,101,102,103,105', '104');
    assert.equal(final.focus, '104');
    assert.equal(final.animations, 0);
    assert.ok(final.positions['104'] < final.positions['101']);
    await photo(page, 'reduced');
    await control(page, '104').click();
    assert.equal((await checkState(page, startOrder)).animations, 0);
  });
} finally {
  await browser.close();
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ checks: report.checks, errors: report.errors }));
if (Object.values(report.checks).some((check) => !check.pass) || report.errors.length) process.exitCode = 1;
