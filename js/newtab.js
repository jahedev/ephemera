import { PALETTES } from "./art/palettes.js";
import { GENERATORS } from "./art/generators.js";
import { mulberry32, randomSeed } from "./art/util.js";

const ENGINES = {
  google: { label: "Google", url: "https://www.google.com/search?q=" },
  youtube: { label: "YouTube", url: "https://www.youtube.com/results?search_query=" },
  duckduckgo: { label: "DuckDuckGo", url: "https://duckduckgo.com/?q=" }
};

const DEFAULTS = { searchEnabled: false, engine: "google", style: "auto" };

const $ = (id) => document.getElementById(id);
const canvas = $("wall");
const caption = $("caption");
const searchForm = $("search");
const qInput = $("q");
const panel = $("panel");
const btnNew = $("btn-new");
const btnDownload = $("btn-download");
const btnSettings = $("btn-settings");
const optSearch = $("opt-search");
const optStyle = $("opt-style");
const rowEngine = $("row-engine");

let settings = { ...DEFAULTS };
let state = { seed: 0, styleId: GENERATORS[0].id };
let downloading = false;

// ---- storage (chrome.storage.sync in the extension, localStorage fallback) ----
const hasChrome = typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync;

function loadSettings() {
  if (hasChrome) {
    return new Promise((res) => chrome.storage.sync.get(DEFAULTS, res));
  }
  try {
    return Promise.resolve({ ...DEFAULTS, ...(JSON.parse(localStorage.getItem("ant-settings")) || {}) });
  } catch {
    return Promise.resolve({ ...DEFAULTS });
  }
}

function saveSettings() {
  if (hasChrome) chrome.storage.sync.set(settings);
  else localStorage.setItem("ant-settings", JSON.stringify(settings));
}

// ---- rendering ----
// Renders into any canvas at cssW x cssH logical units scaled by pxScale.
// Same (seed, styleId, cssW, cssH) always produces the same image, so the
// download path re-renders the visible wallpaper at 4K.
function renderTo(cnv, cssW, cssH, pxScale, seed, styleId) {
  cnv.width = Math.round(cssW * pxScale);
  cnv.height = Math.round(cssH * pxScale);
  const ctx = cnv.getContext("2d");
  ctx.save();
  ctx.scale(pxScale, pxScale);
  const rng = mulberry32(seed);
  const pal = PALETTES[Math.floor(rng() * PALETTES.length)];
  const gen = GENERATORS.find((g) => g.id === styleId) || GENERATORS[0];
  gen.draw(ctx, cssW, cssH, rng, pal, pxScale);
  ctx.restore();
  return { pal, gen };
}

function renderMain() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { pal, gen } = renderTo(canvas, w, h, dpr, state.seed, state.styleId);
  canvas.classList.add("ready");
  caption.textContent = `${gen.name} · ${pal.name}`;
}

function pickStyle() {
  if (settings.style !== "auto") return settings.style;
  return GENERATORS[Math.floor(Math.random() * GENERATORS.length)].id;
}

function newWallpaper() {
  state = { seed: randomSeed(), styleId: pickStyle() };
  renderMain();
}

function download() {
  if (downloading) return;
  downloading = true;
  btnDownload.classList.add("busy");
  // let the spinner paint before the heavy synchronous render
  setTimeout(() => {
    try {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const k = Math.max(3840 / w, 2160 / h, window.devicePixelRatio || 1);
      const off = document.createElement("canvas");
      renderTo(off, w, h, k, state.seed, state.styleId);
      off.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `wallpaper-${state.styleId}-${state.seed.toString(36)}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        btnDownload.classList.remove("busy");
        downloading = false;
      }, "image/png");
    } catch (err) {
      btnDownload.classList.remove("busy");
      downloading = false;
      throw err;
    }
  }, 40);
}

// ---- UI sync ----
function applySettings() {
  searchForm.classList.toggle("hidden", !settings.searchEnabled);
  rowEngine.classList.toggle("hidden", !settings.searchEnabled);
  optSearch.checked = settings.searchEnabled;
  optStyle.value = settings.style;
  qInput.placeholder = `Search ${ENGINES[settings.engine].label}…`;
  document.querySelectorAll(".eng").forEach((b) => {
    b.classList.toggle("active", b.dataset.engine === settings.engine);
  });
  document.querySelectorAll("#opt-engine button").forEach((b) => {
    b.classList.toggle("active", b.dataset.v === settings.engine);
  });
}

function setEngine(v) {
  settings.engine = v;
  saveSettings();
  applySettings();
}

// ---- wiring ----
optStyle.innerHTML = "";
const autoOpt = document.createElement("option");
autoOpt.value = "auto";
autoOpt.textContent = "Surprise me";
optStyle.appendChild(autoOpt);
for (const g of GENERATORS) {
  const o = document.createElement("option");
  o.value = g.id;
  o.textContent = g.name;
  optStyle.appendChild(o);
}

btnNew.addEventListener("click", newWallpaper);
btnDownload.addEventListener("click", download);
btnSettings.addEventListener("click", (e) => {
  e.stopPropagation();
  panel.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!panel.classList.contains("hidden") && !panel.contains(e.target)) {
    panel.classList.add("hidden");
  }
});

optSearch.addEventListener("change", () => {
  settings.searchEnabled = optSearch.checked;
  saveSettings();
  applySettings();
});

optStyle.addEventListener("change", () => {
  settings.style = optStyle.value;
  saveSettings();
  newWallpaper();
});

document.querySelectorAll(".eng").forEach((b) => {
  b.addEventListener("click", () => {
    setEngine(b.dataset.engine);
    qInput.focus();
  });
});
document.querySelectorAll("#opt-engine button").forEach((b) => {
  b.addEventListener("click", () => setEngine(b.dataset.v));
});

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = qInput.value.trim();
  if (q) location.href = ENGINES[settings.engine].url + encodeURIComponent(q);
});

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  const k = e.key.toLowerCase();
  if (k === "n") newWallpaper();
  else if (k === "d") download();
  else if (k === "/" && settings.searchEnabled) {
    e.preventDefault();
    qInput.focus();
  }
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderMain, 180);
});

// ---- init ----
(async function init() {
  settings = await loadSettings();
  if (!ENGINES[settings.engine]) settings.engine = DEFAULTS.engine;
  if (settings.style !== "auto" && !GENERATORS.some((g) => g.id === settings.style)) {
    settings.style = "auto";
  }

  // debug/preview overrides: newtab.html?style=silk&seed=42&search=1
  const qp = new URLSearchParams(location.search);
  if (qp.has("search")) settings.searchEnabled = qp.get("search") !== "0";
  applySettings();

  state = { seed: randomSeed(), styleId: pickStyle() };
  if (qp.has("seed")) state.seed = Number(qp.get("seed")) >>> 0;
  if (qp.has("style") && GENERATORS.some((g) => g.id === qp.get("style"))) {
    state.styleId = qp.get("style");
  }
  renderMain();
})();
