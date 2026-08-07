// Persistence.
//
// Settings and pins go to chrome.storage.sync so they follow the profile.
// Notes and the current print go to chrome.storage.local: notes can hold a lot
// of text and sync caps items at 8 KB, and which wallpaper you're looking at is
// a property of this machine, not of you. Outside the extension (serving the
// folder for development) both areas fall back to localStorage.

export const DEFAULTS = {
  version: 3,
  dim: 0.3,
  motion: true,
  clock: { enabled: true, hour12: true, seconds: false, date: true },
  search: {
    enabled: true,
    engine: "google",
    // display order doubles as the Tab cycle order
    order: ["google", "youtube", "duckduckgo", "gmail", "maps"],
    hidden: [],
    custom: [],
    // Chrome focuses the omnibox on a new tab; opt in to stealing it.
    autofocus: false
  },
  pins: { enabled: true, icons: "favicon", items: [] },
  notes: { enabled: true },
  wallpaper: { style: "auto", cadence: "tab", annotation: true }
};

// Per-item ceiling in chrome.storage.sync. Leave room for the key and JSON
// overhead so the guard trips before Chrome silently rejects the write.
const SYNC_ITEM_LIMIT = 8192;
const SYNC_WARN_AT = 7600;

export const MAX_HISTORY = 20;
export const MAX_FAVORITES = 60;

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

// Set by the page so a failed write can say so instead of vanishing.
let report = () => {};
export function onWriteError(fn) {
  report = fn;
}

const LABEL = { settings: "Settings", favorites: "Favorites" };

function writeArea(area, patch) {
  Object.assign(cache[area], patch);

  if (area === "sync") {
    for (const [key, value] of Object.entries(patch)) {
      const size = JSON.stringify(value).length + key.length;
      if (size > SYNC_WARN_AT) {
        report(
          size > SYNC_ITEM_LIMIT
            ? `${LABEL[key] || key} too large to sync — remove some pins or engines`
            : `${LABEL[key] || key} nearly at the sync limit`
        );
        if (size > SYNC_ITEM_LIMIT) return;
      }
    }
  }

  try {
    if (hasExt) {
      chrome.storage[area].set(patch, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          console.warn("Ephemera: could not save", area, err.message);
          report("Could not save — " + err.message);
        }
      });
    } else {
      localStorage.setItem(LS + area, JSON.stringify(cache[area]));
    }
  } catch (err) {
    console.warn("Ephemera: could not save", area, err);
    report("Could not save your changes");
  }
}

// Cross-tab updates. Every new tab is its own page, so without this a second
// tab keeps a stale copy - and for notes that means it can overwrite a note
// added elsewhere the next time it saves.
export function watchExternal({ onSettings, onNotes, onFavorites }) {
  if (!hasExt || !chrome.storage.onChanged) return;
  chrome.storage.onChanged.addListener((changes, area) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (newValue === undefined) continue;
      // ignore the echo of our own write
      if (JSON.stringify(cache[area]?.[key]) === JSON.stringify(newValue)) continue;
      cache[area][key] = newValue;
      if (area === "sync" && key === "settings") onSettings?.(merge(DEFAULTS, newValue));
      if (area === "sync" && key === "favorites") onFavorites?.(newValue);
      if (area === "local" && key === "notes") onNotes?.(newValue);
    }
  });
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
    print: local.print || null,
    favorites: Array.isArray(sync.favorites) ? sync.favorites : [],
    history: Array.isArray(local.history) ? local.history : []
  };
}

export function saveFavorites(favorites) {
  writeArea("sync", { favorites: favorites.slice(-MAX_FAVORITES) });
}

export function saveHistory(history) {
  writeArea("local", { history: history.slice(-MAX_HISTORY) });
}

// Everything worth carrying to another machine, as one JSON file.
export function exportAll({ settings, favorites, notes }) {
  return JSON.stringify(
    { app: "ephemera", version: DEFAULTS.version, exported: new Date().toISOString(), settings, favorites, notes },
    null,
    2
  );
}

export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!data || data.app !== "ephemera") throw new Error("That isn't an Ephemera backup file.");
  return {
    settings: merge(DEFAULTS, data.settings),
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    notes: Array.isArray(data.notes) ? data.notes : []
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
