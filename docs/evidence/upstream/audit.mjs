// From the workspace root: node docs/evidence/upstream/audit.mjs
// Requires workspace-local playwright and a Playwright Chromium install.
// Override UPSTREAM, PLAYWRIGHT_MODULE, BROWSER_EXE, or EVIDENCE if needed.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const evidence = resolve(process.env.EVIDENCE || dirname(fileURLToPath(import.meta.url)));
const root = resolve(process.env.UPSTREAM || '.research-upstream');
const playwrightModule = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : 'playwright';
const { chromium } = await import(playwrightModule);
const names = 'button toggle slider checkbox radio input tabs progress rating toast tooltip'.split(' ');
const origin = 'http://sakuga.test';
const mono = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.json': 'application/json' };
const log = { testedAtUTC: new Date().toISOString(), node: process.version, realtime: {}, stepped: {}, findings: {}, pageErrors: [] };
await mkdir(join(evidence, 'frames'), { recursive: true });

const browser = await chromium.launch({
  ...(process.env.BROWSER_EXE && { executablePath: process.env.BROWSER_EXE }),
  args: ['--disable-crash-reporter', '--disable-crashpad', '--disable-breakpad'],
});
let errors = log.pageErrors;
async function pageFor(options = {}, seeded = false) {
  const context = await browser.newContext({ viewport: { width: 1100, height: 820 }, ...options });
  await context.route(origin + '/**', async route => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    assert(file.startsWith(root + sep));
    try { await route.fulfill({ contentType: mono[extname(file)] || 'text/plain', body: await readFile(file) }); }
    catch { await route.fulfill({ status: 404, body: 'Missing in checked-out upstream' }); }
  });
  if (seeded) await context.addInitScript(() => {
    let seed = 773377;
    Math.random = () => ((seed = Math.imul(1664525, seed) + 1013904223 >>> 0) / 4294967296);
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  return page;
}
async function open(page, path) {
  const response = await page.goto(origin + path);
  assert.equal(response.status(), 200, path);
  await page.waitForFunction(() => !!window.SakugaFX);
}
const lv = (page, tag, child) => page.locator('sakuga-' + tag).first().locator(child);
const prop = (page, tag, property) => page.locator('sakuga-' + tag).first().evaluate((el, p) => el[p], property);
const wait = (ms) => new Promise(done => setTimeout(done, ms));
async function sample(page, tag, inner, index, label, padX = 150, padY = 120) {
  const box = await lv(page, tag, inner).boundingBox();
  const vw = page.viewportSize().width, vh = page.viewportSize().height;
  const w = Math.ceil(box.width + 2 * padX), h = Math.ceil(box.height + 2 * padY);
  const clip = {
    x: Math.max(0, Math.min(vw - w, Math.floor(box.x - padX))),
    y: Math.max(0, Math.min(vh - h, Math.floor(box.y - padY))),
    width: Math.min(vw, w), height: Math.min(vh, h)
  };
  return async () => {
    const filename = `${tag}-${String(index).padStart(2, '0')}-${label}.png`;
    await page.screenshot({ path: join(evidence, 'frames', filename), clip });
    return filename;
  };
}
async function shots(page, tag, inner, checkpoints, pads) {
  const captures = await Promise.all(checkpoints.map(([_, label], index) => sample(page, tag, inner, index, label, ...pads)));
  const record = [];
  for (const [index, [steps, label, action]] of checkpoints.entries()) {
    const state = await page.evaluate(({ steps, action, tag }) => {
      const host = document.querySelector('sakuga-' + tag);
      if (action) {
        if (tag === 'progress') host.set(action.value, !!action.instant);
        else if (tag === 'slider') {
          if (action.release) host.shadowRoot.querySelector('input').dispatchEvent(new Event('change'));
          else host.value = action.value;
        } else {
          const button = host.shadowRoot.querySelector('button');
          if (tag === 'button') button.dispatchEvent(new PointerEvent('pointerup'));
          button.click();
        }
      }
      for (let i = 0; i < steps; ++i) SakugaFX.advance(1 / 60);
      const element = host.shadowRoot.querySelector('button,.prog,.th');
      return { dtFrames: steps, clock: SakugaFX.now, frame: host.shown ?? null,
        value: host.value ?? null, peak: host.peak ?? null, velocity: host.s?.v ?? host.spd ?? null,
        checked: host.checked ?? null, stage: host.p ?? null, done: host.done ?? null,
        transform: element.style.transform || '', inverse: element.classList.contains('inv') };
    }, { steps, action, tag });
    record.push({ label, filename: await captures[index](), ...state });
  }
  log.stepped[tag] = record;
}

try {
  log.browser = browser.version();
  const page = await pageFor();
  await open(page, '/gallery/');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('sakuga-button')].length), 3);
  assert.deepEqual(await page.evaluate(n => n.filter(name => !customElements.get('sakuga-' + name)), names), []);
  log.realtime.desktopWidth = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
  assert.deepEqual(log.realtime.desktopWidth, [1100, 1100]);
  await page.screenshot({ path: join(evidence, 'gallery-desktop.png') });

  const button = lv(page, 'button', '.btn');
  await page.keyboard.press('Tab');
  await button.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => +document.querySelector('sakuga-button').b.style.getPropertyValue('--ok') > 0.6);
  assert.equal(await page.locator('canvas.sakuga-fx').count(), 1);
  log.realtime.button = 'Enter, confirmation check, one shared front Canvas';
  await page.locator('sakuga-button[variant=secondary]').first().locator('button').click();
  log.realtime.button += ', secondary mouse click';
  const toggle = lv(page, 'toggle', '.tog');
  await toggle.click();
  assert.equal(await prop(page, 'toggle', 'checked'), true);
  await page.waitForFunction(() => document.querySelector('sakuga-toggle').shown === 42);
  const toggleFrames = await page.evaluate(async () => {
    const visible = () => document.querySelector('sakuga-toggle').shown;
    const frames = [visible()];
    for (let i = 0; i < 32; i++) {
      await new Promise(requestAnimationFrame);
      if (frames.at(-1) !== visible()) frames.push(visible());
    }
    return frames;
  });
  assert.deepEqual(toggleFrames, [42]);
  await toggle.press('Space');
  assert.equal(await toggle.getAttribute('aria-checked'), 'false');
  await page.waitForFunction(() => document.querySelector('sakuga-toggle').shown === 0);
  log.realtime.toggle = 'mouse ON, Space OFF, ARIA immediate, settles on 42 and 0';

  const slider = lv(page, 'slider', 'input');
  await slider.scrollIntoViewIfNeeded();
  const r = await slider.boundingBox();
  await page.evaluate(() => {
    const slider = document.querySelector('sakuga-slider');
    window.sampleVelocity = observed => {
      const before = slider.frame.bind(slider);
      slider.frame = dt => { before(dt); observed.push([SakugaFX.now, slider.s.v, slider.peak, slider.value]); };
    };
    window.measured = [];
    window.sampleVelocity(measured);
  });
  const y = r.y + r.height / 2;
  const dx = fraction => r.x + 10 + (r.width - 20) * fraction;
  await page.mouse.move(dx(.30), y); await page.mouse.down();
  for (let i = 1; i <= 22; i++) { await page.mouse.move(dx(.3 + i * .01), y); await wait(75); }
  await page.mouse.up(); await wait(450);
  const slow = await page.evaluate(() => Math.max(...measured.splice(0).map(s => Math.abs(s[1]))));
  await page.mouse.move(dx(.52), y); await page.mouse.down(); await page.mouse.move(dx(.91), y, { steps: 2 }); await wait(80);
  const beforeHold = await prop(page, 'slider', 'peak');
  await wait(1200);
  const afterHold = await prop(page, 'slider', 'peak');
  await page.mouse.up(); await wait(130);
  const moved = +await prop(page, 'slider', 'value');
  assert(moved >= 85);
  await slider.press('ArrowLeft');
  assert.equal(+await prop(page, 'slider', 'value'), moved - 1);
  log.realtime.slider = { slowMaxSpringSpeed: slow, afterFastMovePeak: beforeHold, afterHoldPeak: afterHold, moved, keyResult: moved - 1 };

  await lv(page, 'checkbox', '.box').click();
  assert.equal(await prop(page, 'checkbox', 'checked'), true);
  await lv(page, 'checkbox', 'input').press('Space');
  assert.equal(await prop(page, 'checkbox', 'checked'), false);
  log.realtime.checkbox = 'mouse checks, Space unchecks';
  await lv(page, 'radio', 'label:nth-child(2) .dot').click();
  assert.equal(await prop(page, 'radio', 'value'), 'b');
  await lv(page, 'radio', 'label:nth-child(2) input').press('ArrowUp');
  assert.equal(await prop(page, 'radio', 'value'), 'a');
  log.realtime.radio = 'mouse B, ArrowUp A';
  const input = lv(page, 'input', 'input');
  await input.click();
  await input.pressSequentially('hey', { delay: 37 });
  assert.equal(await prop(page, 'input', 'value'), 'hey');
  log.realtime.input = 'mouse focus, keyboard types hey';
  await lv(page, 'tabs', 'button:nth-of-type(3)').click();
  assert.equal(await prop(page, 'tabs', 'selected'), 2);
  await lv(page, 'tabs', 'button:nth-of-type(3)').press('ArrowLeft');
  assert.equal(await prop(page, 'tabs', 'selected'), 1);
  log.realtime.tabs = 'mouse selects third, ArrowLeft selects second';
  const five = lv(page, 'rating', 'button:nth-child(5)');
  await five.click();
  await page.waitForFunction(() => document.querySelector('sakuga-rating').shadowRoot.querySelectorAll('.lit').length === 5);
  await five.press('ArrowLeft');
  assert.equal(await prop(page, 'rating', 'value'), 4);
  log.realtime.rating = 'mouse five (all lit), ArrowLeft four';
  await page.locator('[data-demo=save]').locator('button').click();
  assert.equal(await prop(page, 'toast', 'open'), true);
  await lv(page, 'toast', '.x').click();
  assert.equal(await prop(page, 'toast', 'open'), false);
  await page.locator('[data-demo=save]').locator('button').click();
  await page.waitForFunction(() => !document.querySelector('sakuga-toast').open);
  log.realtime.toast = 'mouse shows, dismiss closes, repeat with auto-hide';
  await lv(page, 'tooltip', '.help').hover();
  assert.equal(await prop(page, 'tooltip', 'open'), true);
  await lv(page, 'tooltip', '.help').press('Escape');
  assert.equal(await prop(page, 'tooltip', 'open'), false);
  log.realtime.tooltip = 'mouse hover, Escape closes';
  const progress = page.locator('sakuga-progress').first();
  await progress.scrollIntoViewIfNeeded();
  await progress.evaluate(el => {
    el.removeAttribute('demo'); el.reset();
    window.doneCount = 0; el.addEventListener('sakuga:done', () => doneCount++);
    el.set(1);
  });
  await page.waitForFunction(() => document.querySelector('sakuga-progress').done);
  assert.equal(await lv(page, 'progress', '.prog').getAttribute('aria-valuenow'), '100');
  assert.equal(await page.evaluate(() => doneCount), 1);
  log.realtime.progress = 'real clock, set(1) then aria-valuenow=100 and one completion event';
  log.realtime.form = await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML = '<sakuga-checkbox name="c" checked></sakuga-checkbox><sakuga-slider name="s" value="42"></sakuga-slider><sakuga-rating name="r" value="3"></sakuga-rating><sakuga-toggle name="t" checked></sakuga-toggle><sakuga-input name="i" value="hi"></sakuga-input><sakuga-radio name="p"><option value="b" selected>B</option></sakuga-radio>';
    document.body.append(form);
    const value = new URLSearchParams(new FormData(form)).toString();
    form.remove();
    return value;
  });
  assert.equal(log.realtime.form, 'c=on&s=42&r=3&t=on&i=hi&p=b');
  await page.close();

  const mobile = await pageFor({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await open(mobile, '/gallery/');
  log.realtime.mobileWidth = await mobile.evaluate(() => [innerWidth, document.documentElement.scrollWidth, devicePixelRatio]);
  assert.deepEqual(log.realtime.mobileWidth, [390, 390, 2]);
  await mobile.screenshot({ path: join(evidence, 'gallery-390.png') });
  await lv(mobile, 'button', '.btn').tap();
  await mobile.waitForFunction(() => +document.querySelector('sakuga-button').b.style.getPropertyValue('--ok') > .6);
  await lv(mobile, 'toggle', '.tog').tap();
  assert.equal(await prop(mobile, 'toggle', 'checked'), true);
  const track = lv(mobile, 'slider', 'input');
  await track.scrollIntoViewIfNeeded();
  const b = await track.boundingBox();
  const touchSession = await mobile.context().newCDPSession(mobile);
  const touch = (type, x) => touchSession.send('Input.dispatchTouchEvent', {
    type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: Math.round(b.y + b.height / 2) }]
  });
  await touch('touchStart', b.x + Math.round(b.width * .35));
  for (let i = 1; i <= 10; i++) {
    await touch('touchMove', b.x + Math.round(b.width * (.35 + .055 * i)));
    await wait(22);
  }
  await touch('touchEnd');
  assert(+await prop(mobile, 'slider', 'value') > 75);
  await lv(mobile, 'checkbox', '.box').tap();
  assert.equal(await prop(mobile, 'checkbox', 'checked'), true);
  await lv(mobile, 'tooltip', '.help').tap();
  assert.equal(await prop(mobile, 'tooltip', 'open'), true);
  log.realtime.touch = ['button', 'toggle', 'slider (CDP gesture)', 'checkbox', 'tooltip'];
  await mobile.close();

  const standalone = await pageFor();
  log.realtime.standalone = {};
  for (const name of names) {
    await open(standalone, '/' + name + '/');
    const record = await standalone.evaluate(n => [document.title, !!document.querySelector('#el')?.ready,
      !!customElements.get('sakuga-' + n)], name);
    assert.equal(record[1], true, name);
    assert.equal(record[2], true, name);
    log.realtime.standalone[name] = record[0];
  }
  await open(standalone, '/skills/sakuga-vfx/starter.html');
  await standalone.locator('like-button').evaluate(el => {
    window.likeEvents = 0;
    el.addEventListener('change', () => likeEvents++);
  });
  await standalone.getByRole('button', { name: 'Like' }).click();
  assert.equal(await standalone.getByRole('button', { name: 'Like' }).getAttribute('aria-pressed'), 'true');
  await standalone.getByRole('button', { name: 'Like' }).click();
  assert.equal(await standalone.getByRole('button', { name: 'Like' }).getAttribute('aria-pressed'), 'false');
  log.realtime.starter = 'mouse like and unlike; aria-pressed follows';
  log.findings.starterChangesForTwoClicks = await standalone.evaluate(() => likeEvents);
  assert.equal(log.findings.starterChangesForTwoClicks, 1);
  await standalone.close();

  const frame = await pageFor({}, true);
  await open(frame, '/button/');
  await frame.evaluate(() => {
    SakugaFX.paused = true;
    document.querySelector('sakuga-button').b.dispatchEvent(new PointerEvent('pointerdown'));
  });
  await shots(frame, 'button', '.btn', [
    [0, 'press-000'], [6, 'press-100'], [0, 'click-000', {}], [3, 'click-050'],
    [8, 'click-183'], [1, 'click-200'], [15, 'click-450'], [24, 'click-850'], [32, 'click-1383']
  ], [150, 120]);
  const inverses = log.stepped.button.filter(x => x.inverse).map(x => x.label);
  assert.deepEqual(inverses, ['click-000','click-050','click-183']);

  await open(frame, '/slider/');
  await frame.evaluate(() => { SakugaFX.paused = true; });
  await shots(frame, 'slider', '.sld', [
    [0, 'initial'], [4, 'slow-step', { value: 31 }], [18, 'slow-rest'],
    [5, 'fast-jump', { value: 85 }], [6, 'trail'], [25, 'hold'], [46, 'quiet'],
    [5, 'fast-back', { value: 28 }], [5, 'release-slash', { release: true }], [40, 'release-tail'], [60, 'release-rest']
  ], [125, 112]);

  await open(frame, '/progress/');
  await frame.evaluate(() => {
    SakugaFX.paused = true;
    const el = document.querySelector('sakuga-progress');
    el.removeAttribute('demo'); el.reset(); el.spd = 0; el.acc = 0; el.size.x = 0;
  });
  await shots(frame, 'progress', '.bar', [
    [0, 'initial'], [14, 'surge', { value: .70 }], [18, 'rumble'], [70, 'hold'],
    [0, 'complete-target', { value: 1, instant: true }], [5, 'complete-hit'],
    [18, 'complete-tail'], [60, 'complete-hold'], [66, 'complete-rest']
  ], [150, 152]);

  await open(frame, '/toggle/');
  await frame.waitForFunction(() => document.querySelector('sakuga-toggle').shown === 0);
  await frame.evaluate(() => { SakugaFX.paused = true; });
  await shots(frame, 'toggle', '.tog', [
    [0, 'off'], [0, 'on-start', {}], [8, 'on-anticipation'], [12, 'on-smear'],
    [8, 'on-impact'], [20, 'on-splash'], [16, 'on-wobble'], [20, 'on-glint'],
    [2, 'on-settle'], [0, 'off-seam', {}], [10, 'off-return'], [12, 'off-rest']
  ], [55, 118]);
  assert.deepEqual(log.stepped.toggle.map(x => x.frame), [0, 0, 4, 10, 14, 24, 32, 42, 42, 11, 6, 0]);
  await frame.evaluate(() => {
    document.querySelector('sakuga-toggle').b.click();
    for (let i = 0; i < 8; i++) SakugaFX.advance(1 / 60);
  });
  await frame.emulateMedia({ reducedMotion: 'reduce' });
  await frame.waitForFunction(() => SakugaFX.calm);
  const toggleDuringReduced = await frame.evaluate(() => {
    const el = document.querySelector('sakuga-toggle');
    const previous = el.shown;
    for (let i = 0; i < 8; i++) SakugaFX.advance(1 / 60);
    return { previous, afterChange: el.shown, checked: el.checked };
  });
  assert.deepEqual(toggleDuringReduced, { previous: 4, afterChange: 8, checked: true });
  log.findings.toggleActiveThenReduced = toggleDuringReduced;
  await frame.close();

  const calm = await pageFor({ reducedMotion: 'reduce' });
  await open(calm, '/gallery/');
  assert.equal(await calm.evaluate(() => SakugaFX.calm), true);
  await lv(calm, 'button', '.btn').click();
  const stillMoves = await lv(calm, 'button', '.btn').evaluate(el => el.classList.contains('inv'));
  await lv(calm, 'toggle', '.tog').click();
  const calmToggle = await prop(calm, 'toggle', 'shown');
  assert.equal(calmToggle, 42);
  assert.equal(await calm.locator('canvas.sakuga-fx').count(), 0);
  log.findings.initialReduced = { buttonStillInverts: stillMoves, toggleFrame: calmToggle, frontCanvas: 0 };
  await calm.emulateMedia({ reducedMotion: 'no-preference' });
  await calm.waitForFunction(() => !SakugaFX.calm);
  await calm.close();

  const active = await pageFor({}, true);
  await open(active, '/progress/');
  const alpha = () => {
    const canvas = document.querySelector('.sakuga-fx');
    if (!canvas) return 0;
    const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let pixels = 0;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] > 127) pixels++;
    return pixels;
  };
  async function prepare(page) {
    await page.evaluate(() => {
      const el = document.querySelector('sakuga-progress');
      el.removeAttribute('demo'); el.reset(); el.set(.23, true);
    });
    await page.waitForFunction(() => +document.querySelector('sakuga-progress').box.getAttribute('aria-valuenow') === 23);
    await page.waitForTimeout(300);
  }
  await prepare(active);
  const beforeReduce = await active.evaluate(alpha);
  await active.emulateMedia({ reducedMotion: 'reduce' });
  await active.waitForFunction(() => SakugaFX.calm);
  await active.waitForTimeout(220);
  const afterReduce = await active.evaluate(alpha);
  assert(beforeReduce > 0 && afterReduce > 0);
  log.findings.progressActiveThenReduced = { beforeReduce, afterReduce };
  await active.evaluate(() => document.querySelector('sakuga-progress').remove());
  await active.waitForTimeout(130);
  assert.equal(await active.evaluate(alpha), 0);
  log.findings.progressRemoved = { frontPixelsAfterFrame: 0 };
  await active.close();

  const dormant = await pageFor({ reducedMotion: 'reduce' }, true);
  await open(dormant, '/progress/');
  await dormant.emulateMedia({ reducedMotion: 'no-preference' });
  await dormant.waitForFunction(() => !SakugaFX.calm);
  await prepare(dormant);
  const afterEnable = await dormant.evaluate(alpha);
  const retained = await dormant.evaluate(() => !!document.querySelector('sakuga-progress').layer);
  assert.equal(afterEnable, 0);
  assert(retained);
  await dormant.evaluate(() => {
    const el = document.querySelector('sakuga-progress');
    const parent = el.parentElement;
    el.remove();
    parent.append(el);
  });
  await dormant.waitForTimeout(350);
  const reconnected = await dormant.evaluate(alpha);
  assert(reconnected > 0);
  log.findings.progressConnectedReducedThenEnabled = { afterEnable, reconnected, retainedLayerObject: retained };
  await dormant.close();

  const paint = await pageFor({}, true);
  await open(paint, '/button/');
  const colors = await paint.evaluate(() => {
    const a = document.querySelector('sakuga-button');
    const initialCanvas = SakugaFX.P.accent;
    a.style.setProperty('--sk-acc', '#005060');
    const cssCheck = getComputedStyle(a.shadowRoot.querySelector('.ok')).stroke;
    const untouchedCanvas = SakugaFX.P.accent;
    SakugaFX.P.accent = '#b34210';
    return { initialCanvas, cssCheck, untouchedCanvas, changedCanvas: SakugaFX.P.accent };
  });
  assert.deepEqual(colors, { initialCanvas: '#ff5fa8', cssCheck: 'rgb(0, 80, 96)', untouchedCanvas: '#ff5fa8', changedCanvas: '#b34210' });
  log.findings.theme = colors;
  await paint.evaluate(() => {
    SakugaFX.paused = true;
    const a = document.querySelector('sakuga-button');
    const wrap = document.createElement('span');
    wrap.style.cssText = 'display:inline-block;vertical-align:middle';
    a.before(wrap);
    wrap.append(a);
    a.b.click();
    for (let i = 0; i < 10; i++) SakugaFX.advance(1 / 60);
    document.querySelector('.sakuga-fx').style.visibility = 'hidden';
  });
  const openClip = await sample(paint, 'button', '.btn', 0, 'layer-open');
  const clipped = await sample(paint, 'button', '.btn', 1, 'layer-clipped');
  await openClip();
  await paint.evaluate(() => { document.querySelector('sakuga-button').parentElement.style.overflow = 'hidden'; });
  await clipped();
  log.findings.clipping = 'same stepped age; front Canvas hidden; overflow:hidden on button parent for second capture';
  await paint.close();

  const rapid = await pageFor({}, true);
  await open(rapid, '/rating/');
  log.findings.rapidRating = await rapid.evaluate(() => {
    SakugaFX.paused = true;
    const el = document.querySelector('sakuga-rating');
    el.btns[4].click();
    SakugaFX.advance(1 / 60);
    el.btns[1].click();
    for (let i = 0; i < 25; i++) SakugaFX.advance(1 / 60);
    return { actualValue: el.value, drawnStars: el.shadowRoot.querySelectorAll('.lit').length };
  });
  assert.deepEqual(log.findings.rapidRating, { actualValue: 2, drawnStars: 5 });

  await open(rapid, '/button/');
  log.findings.rapidButton = await rapid.evaluate(() => {
    SakugaFX.paused = true;
    const el = document.querySelector('sakuga-button');
    el.b.click();
    for (let i = 0; i < 6; i++) SakugaFX.advance(1 / 60);
    el.b.click();
    for (let i = 0; i < 6; i++) SakugaFX.advance(1 / 60);
    return { invAt100msOfSecond: el.b.classList.contains('inv') };
  });
  assert.deepEqual(log.findings.rapidButton, { invAt100msOfSecond: false });
  await rapid.close();
  assert.deepEqual(log.pageErrors, []);
} finally {
  await writeFile(join(evidence, 'audit.json'), JSON.stringify(log, null, 2) + '\n');
  await browser.close();
}
