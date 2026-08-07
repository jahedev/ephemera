// Ephemera - a new print on every tab.
//
// This file owns the settings object and keeps every widget in sync with it.
// Widgets never read storage themselves; they're handed the slice they need
// and a callback to save it.

import { boot, saveSettings, saveNotes, savePrint, debounce } from "./store.js";
import * as Wall from "./wallpaper.js";
import { updateClock } from "./widgets/clock.js";
import { updateSearch, focusSearch } from "./widgets/search.js";
import { updatePins } from "./widgets/pins.js";
import { updateNotes, addNote, relayoutNotes } from "./widgets/notes.js";
import { mountPanel, syncPanel, togglePanel, closePanel, panelOpen } from "./ui/panel.js";
import { toast } from "./ui/toast.js";

const stage = document.getElementById("stage");
const annotation = document.getElementById("annotation");
const btnDownload = document.getElementById("btn-download");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

let settings = null;
let print = null;
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

function renderPrint() {
  const { gen, pal } = Wall.show(print.seed, print.styleId);
  annotation.textContent = `№ ${Wall.seedLabel(print.seed)} · ${gen.name} on ${pal.name} · 1/1`;
  savePrint(print);
}

function shuffle() {
  print = Wall.fresh(settings.wallpaper);
  Wall.paintWash(print.seed);
  renderPrint();
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

/* ---- wiring ---- */

document.getElementById("btn-new").addEventListener("click", shuffle);
document.getElementById("btn-download").addEventListener("click", download);
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
  const t = e.target;
  if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;

  const key = e.key.toLowerCase();
  if (key === "n") (e.shiftKey ? addNote : shuffle)();
  else if (key === "d") download();
  else if (key === ",") togglePanel();
  else if (key === "/") {
    e.preventDefault();
    focusSearch();
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
  const data = await boot();
  settings = data.settings;

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

  // Wash first: it costs nothing and means the tab is never blank while a
  // generator runs.
  Wall.paintWash(print.seed);
  Wall.applyAccent();

  applyAll();
  updateNotes({ list: data.notes, on: settings.notes.enabled, onSave: saveNotes });
  mountPanel({ settings, commit, styles: Wall.styles() });

  document.body.classList.add("ready");
  requestAnimationFrame(renderPrint);
})();
