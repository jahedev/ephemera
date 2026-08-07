#!/usr/bin/env node
// Capture Chrome Web Store screenshots (1280x800) of the real extension.
//
//   node tools/screenshots.mjs
//
// Loads the repo as an unpacked extension in headless Chromium so pins get
// real favicons and chrome.storage behaves as it will in production, seeds a
// scene through chrome.storage.sync, then screenshots it.
//
// Set CHROME to point at a different Chromium binary if the defaults miss.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "store/screenshots");
const PROFILE = resolve(ROOT, "dist/.screenshot-profile");
const PORT = 9333;
const SIZE = { width: 1280, height: 800 };

const CANDIDATES = [
  process.env.CHROME,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

const BROWSER = CANDIDATES.find((p) => existsSync(p));
if (!BROWSER) {
  console.error("No Chromium-based browser found. Set CHROME=/path/to/binary");
  process.exit(1);
}

// Chrome derives an unpacked extension's id from the SHA-256 of its path,
// mapping each of the first 32 hex digits onto a-p.
const EXT_ID = [...createHash("sha256").update(ROOT).digest("hex").slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
  .join("");

const PAGE = `chrome-extension://${EXT_ID}/newtab.html`;

const PINS = [
  { url: "https://github.com", title: "GitHub" },
  { url: "https://news.ycombinator.com", title: "Hacker News" },
  { url: "https://www.figma.com", title: "Figma" },
  { url: "https://claude.ai", title: "Claude" },
  { url: "https://linear.app", title: "Linear" },
  { url: "https://arxiv.org", title: "arXiv" }
];

const base = {
  version: 3,
  dim: 0.24,
  motion: true,
  clock: { enabled: true, hour12: true, seconds: false, date: true },
  search: {
    enabled: true,
    engine: "google",
    order: ["google", "youtube", "duckduckgo", "gmail", "maps"],
    hidden: [],
    custom: [],
    autofocus: false
  },
  // Monogram, not favicon: a throwaway profile has never visited these sites,
  // so the favicon store would hand back six identical placeholder globes.
  pins: { enabled: true, icons: "monogram", items: PINS },
  notes: { enabled: true },
  wallpaper: { style: "auto", cadence: "manual", annotation: true }
};

const NOTES = [
  { id: "s1", fx: 0.06, fy: 0.12, w: 232, h: 176, c: 0, rot: -1.6, text: "Renew the domain before the 14th\n\nCard ending 4417" },
  { id: "s2", fx: 0.95, fy: 0.1, w: 224, h: 168, c: 2, rot: 1.9, text: "Reading list\n\n· Deep Work, ch. 3\n· The Timeless Way of Building" },
  { id: "s3", fx: 0.93, fy: 0.62, w: 216, h: 150, c: 3, rot: -1.1, text: "Standup moved to 10:15" }
];

const FAVORITES = [
  { seed: 0x7e31b8, styleId: "nebula", at: 1 },
  { seed: 0xa17c40, styleId: "highlands", at: 2 },
  { seed: 0x3f9a2c, styleId: "silk", at: 3 },
  { seed: 0x22c9e1, styleId: "mosaic", at: 4 },
  { seed: 0x91d40a, styleId: "aurora", at: 5 },
  { seed: 0x5c2e10, styleId: "topo", at: 6 }
];

// Each scene: a name, the print to show, and what to do once it has loaded.
const SCENES = [
  {
    name: "01-hero",
    seed: 0x91d40a,
    style: "aurora",
    setup: `(async () => { await seed({}); })()`
  },
  {
    name: "02-notes",
    seed: 0xa17c40,
    style: "highlands",
    setup: `(async () => { await seed({}, ${JSON.stringify(NOTES)}); })()`
  },
  {
    name: "03-search",
    seed: 0x3f9a2c,
    style: "silk",
    setup: `(async () => {
      await seed({ search: { ...base.search, order: ["google","youtube","gmail","maps","wayback","github","amazon"], engine: "wayback" } });
      const q = document.getElementById('q');
      q.focus(); q.value = 'anthropic.com';
      q.dispatchEvent(new Event('input'));
    })()`
  },
  {
    name: "04-settings",
    seed: 0x7e31b8,
    style: "nebula",
    setup: `(async () => {
      await seed({});
      document.getElementById('btn-settings').click();
    })()`
  },
  {
    name: "05-kept",
    seed: 0x22c9e1,
    style: "mosaic",
    setup: `(async () => {
      await seed({}, [], ${JSON.stringify(FAVORITES)});
      document.getElementById('btn-settings').click();
      await new Promise(r => setTimeout(r, 250));
      const h = [...document.querySelectorAll('#panel h3')].find(e => e.textContent === 'Kept prints');
      h.scrollIntoView({ block: 'start' });
    })()`
  }
];

/* ---- CDP plumbing ---- */

let msgId = 0;
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  });
  const ready = new Promise((r) => ws.addEventListener("open", r, { once: true }));
  const send = (method, params = {}) =>
    new Promise((res) => {
      const id = ++msgId;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- run ---- */

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(PROFILE, { recursive: true });

const proc = spawn(
  BROWSER,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${SIZE.width},${SIZE.height}`,
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--load-extension=${ROOT}`,
    `--disable-extensions-except=${ROOT}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

process.on("exit", () => proc.kill());

// wait for the debugging endpoint
for (let i = 0; i < 40; i++) {
  try {
    await fetch(`http://localhost:${PORT}/json/version`);
    break;
  } catch {
    await sleep(250);
  }
}
await sleep(1200); // give the extension time to register

for (const scene of SCENES) {
  const url = `${PAGE}?seed=${scene.seed.toString(16).toUpperCase()}&style=${scene.style}`;
  const target = await (await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
  const cdp = connect(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Emulation.setDeviceMetricsOverride", { ...SIZE, deviceScaleFactor: 1, mobile: false });

  // helper the scene setups call, plus the base settings object
  const preamble = `
    const base = ${JSON.stringify(base)};
    async function seed(patch, notes, favorites) {
      const settings = { ...base, ...patch };
      await new Promise(r => chrome.storage.sync.set({ settings, favorites: favorites || [] }, r));
      await new Promise(r => chrome.storage.local.set({ notes: notes || [] }, r));
      location.reload();
      await new Promise(() => {});
    }`;

  // first pass seeds storage and reloads; the reload lands on the same url
  await cdp.send("Page.navigate", { url });
  await sleep(1400);
  await cdp.send("Runtime.evaluate", {
    expression: `(async () => { ${preamble}\n${scene.setup} })()`,
    awaitPromise: false
  });
  await sleep(1800);

  // after the reload, re-run the setup for its non-storage side effects
  await cdp.send("Runtime.evaluate", {
    expression: `(async () => {
      ${preamble}
      async function seed() {}
      ${scene.setup}
    })()`,
    awaitPromise: true
  });
  await sleep(900);

  const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  writeFileSync(`${OUT}/${scene.name}.png`, Buffer.from(shot.data, "base64"));
  console.log(`${OUT}/${scene.name}.png`);
  await cdp.send("Page.close").catch(() => {});
  cdp.close();
}

proc.kill();
rmSync(PROFILE, { recursive: true, force: true });
console.log(`\n${SCENES.length} screenshots at ${SIZE.width}x${SIZE.height}`);
