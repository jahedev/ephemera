// Ephemera - a new print on every tab.
//
// This file owns the settings object and keeps every widget in sync with it.
// Widgets never read storage themselves; they're handed the slice they need
// and a callback to save it.

import {
  boot,
  saveSettings,
  saveNotes,
  savePrint,
  saveFavorites,
  saveHistory,
  exportAll,
  parseImport,
  watchExternal,
  onWriteError,
  debounce,
  MAX_HISTORY
} from "./store.js";
import * as Wall from "./wallpaper.js";
import { updateClock } from "./widgets/clock.js";
import { updateSearch, focusSearch, maybeAutofocus } from "./widgets/search.js";
import { updatePins } from "./widgets/pins.js";
import { updateNotes, adoptNotes, currentNotes, addNote, relayoutNotes } from "./widgets/notes.js";
import { mountPanel, syncPanel, rebind, renderFavorites, togglePanel, closePanel, panelOpen } from "./ui/panel.js";
import { toast } from "./ui/toast.js";

const stage = document.getElementById("stage");
const annotation = document.getElementById("annotation");
const btnDownload = document.getElementById("btn-download");
const btnBack = document.getElementById("btn-back");
const btnForward = document.getElementById("btn-forward");
const btnFav = document.getElementById("btn-fav");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let settings = null;
let print = null;
let favorites = [];
let history = [];
let cursor = -1;
let downloading = false;

/* ---- applying settings ---- */

function applyAll() {
  document.documentElement.style.setProperty("--dim", settings.dim);
  document.body.classList.toggle("motion", settings.motion && !reducedMotion);
  updateClock(settings.clock);
  updateSearch(settings.search, save);
  updatePins(settings.pins, save);
  updateNotes({ on: settings.notes.enabled, onSave: saveNotes });
  annotation.hidden = !settings.wallpaper.annotation;
}

function save() {
  saveSettings(settings);
}

function commit({ rerender = false } = {}) {
  save();
  applyAll();
  syncPanel();
  if (rerender) shuffle();
}

/* ---- the print ---- */

const samePrint = (a, b) => a && b && a.seed === b.seed && a.styleId === b.styleId;

function renderPrint() {
  const { gen, pal } = Wall.show(print.seed, print.styleId);
  annotation.textContent = `№ ${Wall.seedLabel(print.seed)} · ${gen.name} on ${pal.name} · 1/1`;
  savePrint(print);
  paintPrintControls();
}

function paintPrintControls() {
  btnBack.hidden = cursor <= 0;
  btnForward.hidden = cursor < 0 || cursor >= history.length - 1;
  const kept = favorites.some((f) => samePrint(f, print));
  btnFav.classList.toggle("on", kept);
  btnFav.setAttribute("aria-pressed", String(kept));
  btnFav.title = kept ? "Stop keeping this print (F)" : "Keep this print (F)";
}

// History is shared across tabs, so it reads as "the last prints I saw"
// rather than "the last prints this tab made".
function pushHistory(next) {
  history = history.slice(0, cursor + 1);
  if (!samePrint(history[history.length - 1], next)) {
    history.push({ seed: next.seed, styleId: next.styleId });
  }
  if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
  cursor = history.length - 1;
  saveHistory(history);
}

function shuffle() {
  print = Wall.fresh(settings.wallpaper);
  pushHistory(print);
  Wall.paintWash(print.seed);
  renderPrint();
}

function step(delta) {
  const next = cursor + delta;
  if (next < 0 || next >= history.length) return;
  cursor = next;
  print = { ...history[cursor], at: Date.now() };
  Wall.paintWash(print.seed);
  renderPrint();
}

// Jump straight to a kept print, without disturbing where you were in history.
function showPrint(fav) {
  print = { seed: fav.seed, styleId: fav.styleId, at: Date.now() };
  pushHistory(print);
  Wall.paintWash(print.seed);
  renderPrint();
}

function toggleFavorite() {
  const at = favorites.findIndex((f) => samePrint(f, print));
  if (at >= 0) {
    favorites.splice(at, 1);
    toast("Print released");
  } else {
    favorites.push({ seed: print.seed, styleId: print.styleId, at: Date.now() });
    toast(`Keeping ${Wall.seedLabel(print.seed)}`);
  }
  saveFavorites(favorites);
  paintPrintControls();
  if (panelOpen()) renderFavorites();
}

function unfavorite(fav) {
  favorites = favorites.filter((f) => !samePrint(f, fav));
  saveFavorites(favorites);
  paintPrintControls();
  renderFavorites();
}

function download() {
  if (downloading) return;
  downloading = true;
  btnDownload.classList.add("busy");
  Wall.download()
    .catch((err) => {
      console.error(err);
      toast("Could not save that print");
    })
    .finally(() => {
      btnDownload.classList.remove("busy");
      downloading = false;
    });
}

/* ---- backup ---- */

function exportBackup() {
  const blob = new Blob([exportAll({ settings, favorites, notes: currentNotes() })], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ephemera-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast("Backup saved");
}

async function importBackup(file) {
  try {
    const data = parseImport(await file.text());
    Object.keys(settings).forEach((k) => delete settings[k]);
    Object.assign(settings, data.settings);
    favorites = data.favorites;
    saveSettings(settings);
    saveFavorites(favorites);
    saveNotes(data.notes);
    adoptNotes(data.notes);
    applyAll();
    syncPanel();
    renderFavorites();
    toast("Backup restored");
  } catch (err) {
    toast(err.message || "Could not read that file");
  }
}

/* ---- wiring ---- */

document.getElementById("btn-new").addEventListener("click", shuffle);
btnBack.addEventListener("click", () => step(-1));
btnForward.addEventListener("click", () => step(1));
btnFav.addEventListener("click", toggleFavorite);
btnDownload.addEventListener("click", download);
document.getElementById("btn-note").addEventListener("click", () => {
  if (!settings.notes.enabled) {
    settings.notes.enabled = true;
    commit();
  }
  addNote();
});

annotation.addEventListener("click", async () => {
  const label = Wall.seedLabel(print.seed);
  try {
    await navigator.clipboard.writeText(label);
    toast(`Seed ${label} copied`);
  } catch {
    toast(`Seed ${label}`);
  }
});

document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    focusSearch();
    return;
  }
  if (e.key === "Escape" && panelOpen()) {
    closePanel();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  // Buttons stay eligible: single letters don't activate them, and after
  // clicking shuffle the keyboard shortcuts should still work.
  //
  // The target is Document rather than an Element when nothing is focused -
  // which is exactly what happens right after deleting a focused note.
  const t = e.target instanceof Element ? e.target : null;
  if (t) {
    if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
    if (t.closest(".note")) return; // notes handle their own arrow keys
  }

  const key = e.key.toLowerCase();
  if (key === "n") (e.shiftKey ? addNote : shuffle)();
  else if (key === "d") download();
  else if (key === "f") toggleFavorite();
  else if (key === ",") togglePanel();
  else if (e.key === "ArrowLeft") step(-1);
  else if (e.key === "ArrowRight") step(1);
  else if (key === "/") {
    e.preventDefault();
    focusSearch();
  } else if (/^[1-9]$/.test(e.key)) {
    const pin = settings.pins.enabled && settings.pins.items[Number(e.key) - 1];
    if (pin) location.href = pin.url;
  }
});

const onResize = debounce(() => {
  Wall.redraw();
  relayoutNotes();
}, 180);
addEventListener("resize", onResize);

// Parallax: the print sits a little deeper than the chrome above it.
let parallaxQueued = false;
addEventListener("pointermove", (e) => {
  if (!settings?.motion || reducedMotion || parallaxQueued) return;
  parallaxQueued = true;
  requestAnimationFrame(() => {
    parallaxQueued = false;
    stage.style.setProperty("--px", `${(0.5 - e.clientX / innerWidth) * 16}px`);
    stage.style.setProperty("--py", `${(0.5 - e.clientY / innerHeight) * 12}px`);
  });
});

/* ---- start ---- */

(async function init() {
  onWriteError(toast);

  const data = await boot();
  settings = data.settings;
  favorites = data.favorites;
  history = data.history;
  cursor = history.length - 1;

  print = Wall.decide(settings.wallpaper, data.print);

  // Preview overrides for working on generators outside the extension:
  // newtab.html?style=silk&seed=3F9A2C
  const qp = new URLSearchParams(location.search);
  if (qp.has("seed")) {
    const raw = qp.get("seed");
    const n = /^[0-9]+$/.test(raw) ? Number(raw) : parseInt(raw, 16);
    if (Number.isFinite(n)) print.seed = n >>> 0;
  }
  if (qp.has("style") && Wall.styles().some((g) => g.id === qp.get("style"))) {
    print.styleId = qp.get("style");
  }

  pushHistory(print);

  // Wash first: it costs nothing and means the tab is never blank while a
  // generator runs.
  Wall.paintWash(print.seed);
  Wall.applyAccent();

  applyAll();
  updateNotes({ list: data.notes, on: settings.notes.enabled, onSave: saveNotes });
  mountPanel({
    settings,
    commit,
    styles: Wall.styles(),
    favorites: () => favorites,
    showPrint,
    unfavorite,
    exportBackup,
    importBackup
  });

  watchExternal({
    onSettings: (incoming) => {
      // mutate in place: the panel holds a reference to this object
      Object.keys(settings).forEach((k) => delete settings[k]);
      Object.assign(settings, incoming);
      rebind(settings);
      applyAll();
      syncPanel();
    },
    onNotes: adoptNotes,
    onFavorites: (list) => {
      favorites = list;
      paintPrintControls();
      if (panelOpen()) renderFavorites();
    }
  });

  document.body.classList.add("ready");
  maybeAutofocus();
  requestAnimationFrame(renderPrint);
})();
