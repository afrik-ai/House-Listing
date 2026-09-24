// Screenshot harness (P01).
//   node scripts/shot.mjs --pos "x,y,z" --yaw 0 --pitch 0 --tod day --out reviews/x.png
//        [--w 1920 --h 1080] [--quality ultra] [--ui] [--id villa-nova] [--room living] [--view ext_garden_sw]
//        [--base http://127.0.0.1:5173] [--bench] [--hmr] [--attempts 3]
// Robust to Vite HMR reloads: the page's HMR socket is blocked unless --hmr; __game.ready is retried up to
// --attempts (3) times (first load <= 5 min per attempt with progress lines, every later wait <= 60 s);
// the JSON reports readyAttempt/reloads.
// --pos is the EYE position. --room / --view use the game's standard viewpoints instead of --pos.
// Waits for __game.ready, hides UI unless --ui, prints __game.stats() (and console errors) as JSON.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];

export function parseArgs(argv, defaults = {}) {
  const out = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[k] = true;
    else { out[k] = next; i++; }
  }
  return out;
}

// Hard cap for every wait in the harness (Playwright waits and page-side promises): a reload or a
// hung boot can never stall a caller for longer than this per attempt.
export const WAIT_MS = 60000;
// The FIRST load may take minutes on a busy machine (Vite transforming files other builders are
// editing); it gets its own, longer cap and prints progress while waiting.
export const BOOT_MS = 300000;

// Rejects if `promise` does not settle within `ms`.
export function hard(promise, ms = WAIT_MS, label = 'wait') {
  let t;
  return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`Timeout: ${label} exceeded ${ms} ms`)), ms); })]).finally(() => clearTimeout(t));
}

// Opens the game page and waits until __game.ready on a STABLE page. Vite HMR full reloads (other
// builders editing files) can reload the page at any time: a reload during boot, a rejected ready,
// a hang past `timeout` (60 s), or a reload within 500 ms after ready triggers another attempt
// (up to `attempts`, default 3). By default the page's Vite HMR websocket is blocked (it never
// connects), so other builders' edits cannot reload it mid-shot; `hmr: true` (CLI --hmr) opts back in.
// Harness pages (harness=1) additionally ignore HMR updates after boot (main.js) unless &hmr=1.
// First load: up to `bootTimeout` (5 min) per attempt with progress lines; later waits: `timeout` (60 s).
// Returns {browser, page, errors, warnings, loadMs, gpu, readyAttempt, reloads, waitReady}.
// `errors` only holds errors of the page lifetime that succeeded (earlier ones: `staleErrors`).
export async function openGame({ base = 'http://127.0.0.1:5173', id = 'villa-nova', w = 1920, h = 1080, quality = 'high', tod = 'day', timeout = WAIT_MS, bootTimeout = BOOT_MS, attempts = 3, query = '', hmr = false, quiet = false } = {}) {
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(timeout);
  page.setDefaultNavigationTimeout(timeout);
  if (!hmr) {
    // Vite's client opens `new WebSocket(url, 'vite-hmr')`; hand it a socket that never opens (no
    // updates, no reloads, no errors). Everything else is untouched.
    await page.addInitScript(() => {
      const WS = window.WebSocket;
      class NoHMR extends EventTarget {
        constructor(url) { super(); this.url = String(url); this.readyState = 0; this.protocol = 'vite-hmr'; }
        send() {} close() {}
      }
      Object.assign(NoHMR, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
      Object.assign(NoHMR.prototype, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
      const Patched = function (url, protocols) {
        const p = [].concat(protocols || []);
        if (p.some((x) => /^vite-(hmr|ping)$/.test(x))) return new NoHMR(url);
        return new WS(url, protocols);
      };
      Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
      Patched.prototype = WS.prototype;
      window.WebSocket = Patched;
    });
  }
  const errors = [], warnings = [], staleErrors = [];
  const nav = { count: 0 };
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) nav.count++; });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
    else if (m.type() === 'warning') warnings.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!/favicon/.test(r.url()) && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText || ''}`); });
  const url = `${base}/house.html?id=${encodeURIComponent(id)}&harness=1&quality=${quality}&tod=${tod}${hmr ? '&hmr=1' : ''}${query ? '&' + query : ''}`;

  // Waits for __game.ready in whatever document is current, then requires 500 ms without a navigation.
  const waitReady = async (label = 'ready', cap = timeout) => {
    let lastErr;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const nav0 = nav.count, tA = Date.now();
      const left = () => Math.max(1000, cap - (Date.now() - tA));
      // Progress line every 10 s while waiting (loading-bar fraction + label from the game).
      const ticker = quiet ? null : setInterval(async () => {
        const p = await page.evaluate(() => { const g = window.__game?.game; return g ? `${Math.round((g._lastProgress || 0) * 100)}% ${g._lastLabel || ''} [${g.state}]` : 'page loading'; }).catch(() => 'page reloading');
        console.error(`[harness] ${label}: waiting ${((Date.now() - tA) / 1000).toFixed(0)} s (attempt ${attempt}/${attempts}): ${p}`);
      }, 10000);
      try {
        await page.waitForFunction(() => !!window.__game, null, { timeout: left() });
        const ok = await hard(page.evaluate((ms) => Promise.race([
          window.__game.ready.then(() => true, (e) => `ready rejected: ${e?.message || e}`),
          new Promise((r) => setTimeout(() => r(`Timeout: __game.ready not resolved after ${ms} ms`), ms)),
        ]), left()), left() + 2000, `${label} ready`);
        if (ok !== true) throw new Error(ok);
        await page.waitForTimeout(500);
        if (nav.count !== nav0) throw new Error('page reloaded right after ready');
        await hard(page.evaluate(() => window.__game.ready), 5000, `${label} recheck`);   // throws if the context died
        if (attempt > 1) console.error(`[harness] ${label}: ready on attempt ${attempt}/${attempts}`);
        return attempt;
      } catch (err) {
        lastErr = err;
      } finally {
        if (ticker) clearInterval(ticker);
      }
      {
        const err = lastErr;
        if (attempt === attempts) break;
        console.error(`[harness] ${label}: attempt ${attempt}/${attempts} failed (${String(err.message).split('\n')[0]}); retrying`);
        staleErrors.push(...errors.splice(0));
        // A reload already in flight: let it land. Otherwise (rejected ready, hang, dead page) navigate again.
        await page.waitForTimeout(1500).catch(() => {});
        if (nav.count === nav0 || /rejected|Timeout/i.test(err.message)) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: cap }).catch(() => {});
        }
      }
    }
    throw new Error(`[harness] ${label}: game not ready after ${attempts} attempts: ${lastErr?.message}`);
  };

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: bootTimeout }).catch((e) => console.error(`[harness] goto: ${e.message.split('\n')[0]}`));
  let readyAttempt;
  try { readyAttempt = await waitReady('load', bootTimeout); } catch (err) { await browser.close(); throw err; }
  const loadMs = Date.now() - t0;
  const gpu = await hard(page.evaluate(() => {
    const gl = window.__game.game.renderer.gl.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
  }), 10000, 'gpu info').catch(() => 'unknown');
  console.error(`[harness] ready on attempt ${readyAttempt}/${attempts} after ${(loadMs / 1000).toFixed(1)} s`);
  const ctx = { browser, page, errors, warnings, staleErrors, loadMs, gpu, readyAttempt, nav, waitReady, url, hmr, get reloads() { return nav.count - 1; } };
  CTX.set(page, ctx);
  return ctx;
}

const CTX = new WeakMap();
const RELOAD_RE = /Execution context was destroyed|navigat|Target closed|Cannot find context|__game is not defined|Timeout|Cannot read properties of undefined \(reading '(teleport|hideUI|setTimeOfDay|render|stats|state|views|benchmark)'\)/i;

// Runs `fn()` against the page with a hard cap of `ms` (60 s); if the page reloads (HMR) or the step
// hangs, waits for a stable ready page and runs it again (up to 3 attempts). Use for any multi-step
// page.evaluate sequence; `stable(page, () => page.evaluate(...), 'label')`.
export async function stable(page, fn, label = 'step', ms = WAIT_MS) {
  const ctx = CTX.get(page);
  if (!ctx) return hard(fn(), ms, label);
  for (let attempt = 1; ; attempt++) {
    const nav0 = ctx.nav.count;
    try {
      const r = await hard(fn(), ms, label);
      if (ctx.nav.count !== nav0) throw new Error('page navigated during step');
      return r;
    } catch (err) {
      if (attempt >= 3 || !(RELOAD_RE.test(err.message) || ctx.nav.count !== nav0)) throw err;
      console.error(`[harness] ${label}: ${ctx.nav.count !== nav0 ? 'page reloaded' : String(err.message).split('\n')[0]} (attempt ${attempt}/3); waiting for a stable page`);
      if (ctx.nav.count === nav0) await page.goto(ctx.url, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await ctx.waitReady(label);
    }
  }
}


// Places the camera and captures one PNG. `view` = {pos:[x,y,z], yaw, pitch} (eye position).
export async function capture(page, { view, tod, out, ui = false, quality }) {
  return stable(page, () => captureOnce(page, { view, tod, out, ui, quality }), `capture ${path.basename(out)}`);
}

async function captureOnce(page, { view, tod, out, ui, quality }) {
  if (quality) await page.evaluate((q) => { if (window.__game.state().quality !== q) window.__game.setQuality(q); }, quality);
  await page.evaluate(async ({ view, tod, ui }) => {
    const g = window.__game;
    g.hideUI(!ui);
    if (tod) await g.setTimeOfDay(tod);
    g.teleport(view.pos[0], view.pos[1], view.pos[2], view.yaw ?? 0, view.pitch ?? 0);
    // Let shadows/AO/bloom settle for a few real frames, then force one final render.
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    g.render();
  }, { view, tod, ui });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  await page.screenshot({ path: out, type: 'png' });
  return page.evaluate(() => ({ stats: window.__game.stats(), state: window.__game.state() }));
}

async function main() {
  const a = parseArgs(process.argv.slice(2), { yaw: 0, pitch: 0, tod: 'day', w: 1920, h: 1080, quality: 'high', id: 'villa-nova', out: 'reviews/shot.png' });
  const G = await openGame({ base: a.base, id: a.id, w: a.w, h: a.h, quality: a.quality, tod: a.tod, attempts: +(a.attempts || 3), hmr: !!a.hmr });
  const { browser, page, errors, warnings, loadMs, gpu } = G;
  try {
    let view;
    if (a.room || a.view) {
      const views = await stable(page, () => page.evaluate(() => window.__game.views()), 'views');
      view = [...views.rooms, ...views.exteriors].find((v) => v.id === (a.room || a.view));
      if (!view) throw new Error(`no view "${a.room || a.view}". Known: ${[...views.rooms, ...views.exteriors].map((v) => v.id).join(', ')}`);
    } else if (a.pos) {
      view = { pos: String(a.pos).split(',').map(Number), yaw: +a.yaw, pitch: +a.pitch };
    } else {
      const s = await stable(page, () => page.evaluate(() => window.__game.state()), 'state');
      view = { pos: s.eye, yaw: s.yaw, pitch: s.pitch };
    }
    if (view.pos.length !== 3 || view.pos.some(Number.isNaN)) throw new Error('--pos must be "x,y,z"');
    if (a.yaw !== undefined && (a.room || a.view) && process.argv.includes('--yaw')) view.yaw = +a.yaw;
    if (a.pitch !== undefined && (a.room || a.view) && process.argv.includes('--pitch')) view.pitch = +a.pitch;
    const r = await capture(page, { view, tod: a.tod, out: a.out, ui: !!a.ui });
    let bench;
    if (a.bench) bench = await stable(page, () => page.evaluate(() => window.__game.benchmark(120)), 'bench');
    console.log(JSON.stringify({ out: a.out, view, tod: a.tod, quality: a.quality, gpu, loadMs, readyAttempt: G.readyAttempt, reloads: G.reloads, ...r, bench, consoleErrors: errors, consoleWarnings: warnings.slice(0, 10) }, null, 2));
    if (errors.length) process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
