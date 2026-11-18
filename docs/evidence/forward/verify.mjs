import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const modulePath = process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href
  : "playwright";
const { chromium } = await import(modulePath);

const source = new URL("index.html", import.meta.url);
const evidence = new URL("evidence/", import.meta.url);
const executablePath = process.env.SAKUGA_CHROMIUM;
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const viewport = { width: 1200, height: 850 };
const titles = ["逆流", "野地来信", "印刷过夜", "在场练习"];
const checks = [];
const errors = [];

function pass(check) {
  checks.push(check);
  console.log(`PASS ${check}`);
}

async function openPage(options = {}) {
  const page = await browser.newPage({ viewport, ...options });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(source.href);
  return page;
}

function remove(page, title) {
  return page.getByRole("button", { name: `移除《${title}》`, exact: true });
}

function undo(page) {
  return page.getByRole("button", { name: "撤销", exact: true });
}

async function focus(page) {
  return page.locator(":focus").evaluate((element) => element.getAttribute("aria-label") || element.textContent);
}

async function visibleTitles(page) {
  return page.getByRole("listitem").getByRole("heading").allTextContents();
}

async function checkState(page, expected, message) {
  assert.deepEqual(await visibleTitles(page), expected);
  assert.equal(await page.getByRole("status").textContent(), message);
  assert.equal(await undo(page).isDisabled(), expected.length === titles.length);
  assert.equal(await page.locator(".empty").isVisible(), expected.length === 0);
  assert.equal(await page.locator(".count").textContent(),
    `清单内 ${expected.length} 张 · 待撤销 ${titles.length - expected.length} 项`);
}

async function checkRest(page) {
  await page.waitForFunction(() => document.getAnimations().length === 0);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll(".hit-ink, .return-ink")]
    .every((el) => getComputedStyle(el).visibility === "hidden")));
}

async function shot(target, name) {
  await target.screenshot({ path: fileURLToPath(new URL(name, evidence)) });
}

async function getGeometry(locator) {
  return locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return [box.x, box.y, box.width, box.height];
  });
}

try {
  const page = await openPage();
  await checkState(page, titles, "已收藏的海报");
  assert.equal(await page.getByRole("button").count(), 5);
  await shot(page, "desktop.png");
  pass("desktop initial list, count and unavailable Undo");

  const first = remove(page, titles[0]);
  const before = await getGeometry(first);
  const point = { x: before[0] + before[2] / 2, y: before[1] + before[3] / 2 };
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  assert.deepEqual(await getGeometry(first), before);
  assert.notEqual(await first.locator("span").evaluate((el) => getComputedStyle(el).transform), "none");
  await page.mouse.move(5, 50);
  await page.mouse.up();
  await checkState(page, titles, "已收藏的海报");
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  pass("pointer hold keeps hitbox fixed; drag away and release leaves original state");

  // Use actual browser pointer events in one short sequence, with Chromium resolving hit tests.
  const secondPoint = await remove(page, titles[1]).boundingBox();
  const undoPoint = await undo(page).boundingBox();
  const rapidStart = performance.now();
  await page.mouse.click(secondPoint.x + secondPoint.width / 2, secondPoint.y + secondPoint.height / 2);
  assert.equal(await remove(page, titles[1]).count(), 0);
  await page.mouse.click(point.x, point.y);
  await page.mouse.click(undoPoint.x + undoPoint.width / 2, undoPoint.y + undoPoint.height / 2, { clickCount: 2 });
  await page.mouse.click(point.x, point.y);
  const rapidSequenceMs = Math.round(performance.now() - rapidStart);
  assert.ok(await page.evaluate(() => document.getAnimations().length <= 2));
  await checkState(page, titles.slice(1), "已移除《逆流》");
  await checkRest(page);
  await checkState(page, titles.slice(1), "已移除《逆流》");
  await undo(page).click();
  await checkState(page, titles, "已恢复《逆流》");
  await checkRest(page);
  pass("rapid remove, remove, double Undo, remove sequence; state still correct after visual cleanup");
  await page.close();

  const keyboard = await openPage();
  await keyboard.keyboard.press("Tab");
  assert.equal(await focus(keyboard), "移除《逆流》");
  await keyboard.keyboard.down("Enter");
  await keyboard.keyboard.down("Enter");
  await keyboard.keyboard.up("Enter");
  await checkState(keyboard, titles.slice(1), "已移除《逆流》");
  assert.equal(await focus(keyboard), "移除《野地来信》");
  await keyboard.keyboard.press("Space");
  assert.equal(await focus(keyboard), "移除《印刷过夜》");
  await keyboard.keyboard.press("Enter");
  assert.equal(await focus(keyboard), "移除《在场练习》");
  await keyboard.keyboard.press("Space");
  await checkState(keyboard, [], "已移除《在场练习》");
  assert.equal(await focus(keyboard), "撤销");
  const expected = [];
  for (const title of [...titles].reverse()) {
    expected.unshift(title);
    await keyboard.keyboard.press("Enter");
    await checkState(keyboard, expected, `已恢复《${title}》`);
    assert.equal(await focus(keyboard), expected.length === titles.length ? "移除《逆流》" : "撤销");
  }
  await checkRest(keyboard);
  pass("Tab, Enter, Space, held Enter, empty state, four LIFO restorations and recovery focus");
  await keyboard.close();

  const mobile = await openPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  await shot(mobile, "mobile-390-dpr2.png");
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await remove(mobile, titles[1]).tap();
  await checkState(mobile, [titles[0], ...titles.slice(2)], "已移除《野地来信》");
  assert.equal(await mobile.evaluate(() => document.getAnimations().length), 0);
  await undo(mobile).tap();
  await checkState(mobile, titles, "已恢复《野地来信》");
  assert.equal(await mobile.evaluate(() => document.getAnimations().length), 0);
  pass("390 CSS px at DPR 2 with simulated tap and reduced motion set before load");
  await mobile.close();

  const dynamic = await openPage();
  await remove(dynamic, titles[2]).click();
  // Pause the running batch to reliably emulate a preference switch before natural completion.
  assert.equal(await dynamic.evaluate(() => {
    const animations = document.getAnimations();
    animations.forEach((animation) => animation.pause());
    return animations.length;
  }), 2);
  await dynamic.emulateMedia({ reducedMotion: "reduce" });
  await checkRest(dynamic);
  await checkState(dynamic, [titles[0], titles[1], titles[3]], "已移除《印刷过夜》");
  await dynamic.emulateMedia({ reducedMotion: "no-preference" });
  await checkRest(dynamic);
  await undo(dynamic).click();
  assert.equal(await dynamic.evaluate(() => document.getAnimations().length), 2);
  await checkState(dynamic, titles, "已恢复《印刷过夜》");
  await checkRest(dynamic);
  pass("reduce during active removal clears it, preserves state; preference reset waits for next action");
  await dynamic.close();

  // Direct WAAPI sampling fixes elapsed time independently of screenshot capture and input latency.
  const frames = await openPage();
  await frames.emulateMedia({ reducedMotion: "no-preference" });
  const strip = frames.locator(".actions");
  await shot(strip, "remove-000ms-idle.png");
  const target = remove(frames, titles[0]);
  const targetBounds = await target.boundingBox();
  await frames.mouse.move(targetBounds.x + targetBounds.width / 2, targetBounds.y + targetBounds.height / 2);
  await frames.mouse.down();
  await shot(frames.getByRole("listitem").first(), "remove-000ms-held.png");
  await frames.mouse.up();
  const sample = async (times, locator, filePrefix) => {
    const animations = await frames.evaluateHandle(() => {
      const running = document.getAnimations();
      running.forEach((animation) => animation.pause());
      return running;
    });
    assert.equal(await animations.evaluate((running) => running.length), 2);
    for (const ms of times) {
      await animations.evaluate((running, elapsed) => {
        running.forEach((animation) => { animation.currentTime = elapsed; });
      }, ms);
      await shot(locator, `${filePrefix}-${String(ms).padStart(3, "0")}ms.png`);
    }
    await animations.dispose();
  };
  await sample([42, 58, 107, 220], strip, "remove");
  await undo(frames).click();
  await sample([0, 72, 90, 108, 190], frames.getByRole("listitem").first(), "restore");
  await frames.close();
  pass("fixed-time evidence for idle, hold, removal impact and settle, restore and settle");

  assert.deepEqual(errors, []);
  const report = { browser: browser.version(), rapidSequenceMs, checks, pageErrors: errors };
  await writeFile(new URL("report.json", evidence), JSON.stringify(report, null, 2) + "\n", "utf8");
} finally {
  await browser.close();
}
