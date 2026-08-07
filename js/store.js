// Persistence.
//
// Settings and pins go to chrome.storage.sync so they follow the profile.
// Notes and the current print go to chrome.storage.local: notes can hold a lot
// of text and sync caps items at 8 KB, and which wallpaper you're looking at is
// a property of this machine, not of you. Outside the extension (serving the
// folder for development) both areas fall back to localStorage.

export const DEFAULTS = {
  version: 2,
  dim: 0.3,
  motion: true,
  clock: { enabled: true, hour12: true, seconds: false, date: true },
  search: {
    enabled: true,
    engine: "google",
    // display order doubles as the Tab cycle order
    order: ["google", "youtube", "duckduckgo", "gmail", "maps"],
    hidden: [],
    custom: []
  },
  pins: { enabled: true, icons: "favicon", items: [] },
  notes: { enabled: true },
  wallpaper: { style: "auto", cadence: "tab", annotation: true }
};

const hasExt = typeof chrome !== "undefined" && !!chrome.storage?.sync;
const LS = "ephemera:";
const cache = { sync: {}, local: {} };

function readArea(area) {
  if (hasExt) {
    return new Promise((res) => chrome.storage[area].get(null, (v) => res(v || {})));
  }
  try {
    return Promise.resolve(JSON.parse(localStorage.getItem(LS + area)) || {});
  } catch {
    return Promise.resolve({});
  }
}

function writeArea(area, patch) {
  Object.assign(cache[area], patch);
  try {
    if (hasExt) chrome.storage[area].set(patch);
    else localStorage.setItem(LS + area, JSON.stringify(cache[area]));
  } catch (err) {
    console.warn("Ephemera: could not save", area, err);
  }
}

// Deep-merge stored values over the defaults so a settings object written by an
// older version still gains every key added since, and a corrupted value of the
// wrong type falls back instead of breaking the page.
function merge(base, over) {
  if (over === undefined || over === null) return structuredClone(base);
  if (Array.isArray(base)) return Array.isArray(over) ? structuredClone(over) : structuredClone(base);
  if (base && typeof base === "object") {
    if (typeof over !== "object") return structuredClone(base);
    const out = {};
    for (const k of Object.keys(base)) out[k] = merge(base[k], over[k]);
    return out;
  }
  return typeof over === typeof base ? over : base;
}

// v1 kept three flat keys in sync storage. Carry them forward rather than
// resetting people who already had the extension installed.
function migrate(sync) {
  if (sync.settings) return sync.settings;
  if (!("engine" in sync) && !("searchEnabled" in sync) && !("style" in sync)) return null;
  return {
    search: { enabled: !!sync.searchEnabled, engine: sync.engine || "google" },
    wallpaper: { style: sync.style || "auto" }
  };
}

export async function boot() {
  const [sync, local] = await Promise.all([readArea("sync"), readArea("local")]);
  cache.sync = sync;
  cache.local = local;

  const settings = merge(DEFAULTS, migrate(sync));
  settings.version = DEFAULTS.version;
  return {
    settings,
    notes: Array.isArray(local.notes) ? local.notes : [],
    print: local.print || null
  };
}

// chrome.storage.sync allows 120 writes a minute and 1800 an hour, and a
// dragged slider fires far more than that. Coalesce writes and flush whatever
// is outstanding when the page goes away.
let pendingSettings = null;

function flushSettings() {
  if (!pendingSettings) return;
  writeArea("sync", { settings: pendingSettings });
  pendingSettings = null;
}

const flushSettingsSoon = debounce(flushSettings, 350);

export function saveSettings(settings) {
  pendingSettings = settings;
  flushSettingsSoon();
}

addEventListener("pagehide", flushSettings);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushSettings();
});

export function saveNotes(notes) {
  writeArea("local", { notes });
}

export function savePrint(print) {
  writeArea("local", { print });
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
