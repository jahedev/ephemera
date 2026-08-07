// Settings panel wiring. Every control writes straight into the settings
// object and calls commit(), which saves and re-applies.

import * as Engines from "../engines.js";
import * as Wall from "../wallpaper.js";
import { ask } from "./dialog.js";
import { sortable, move } from "./sortable.js";
import { addPin } from "../widgets/pins.js";
import { addNote } from "../widgets/notes.js";

const panel = document.getElementById("panel");
const toggleBtn = document.getElementById("btn-settings");
const engineList = document.getElementById("engine-list");
const favGrid = document.getElementById("fav-grid");
const favEmpty = document.getElementById("fav-empty");

const $ = (id) => document.getElementById(id);

let settings = null;
let commit = () => {};
let host = {};

/* ---- small control helpers ---- */

function segment(el, value, onPick) {
  for (const b of el.querySelectorAll("button")) {
    b.setAttribute("aria-pressed", String(b.dataset.v === String(value)));
  }
  if (el.dataset.wired) return;
  el.dataset.wired = "1";
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) onPick(b.dataset.v);
  });
}

function check(el, value, onChange) {
  el.checked = value;
  if (el.dataset.wired) return;
  el.dataset.wired = "1";
  el.addEventListener("change", () => onChange(el.checked));
}

function choose(el, value, onChange) {
  el.value = value;
  if (el.dataset.wired) return;
  el.dataset.wired = "1";
  el.addEventListener("change", () => onChange(el.value));
}

/* ---- engines ---- */

function engineRow(engine) {
  const li = document.createElement("li");
  li.draggable = true;
  li.dataset.id = engine.id;

  const handle = document.createElement("span");
  handle.className = "handle";
  handle.textContent = "⠿";
  handle.setAttribute("aria-hidden", "true");

  const name = document.createElement("span");
  name.className = "name";
  name.textContent = engine.name;
  const sub = [engine.bang ? `!${engine.bang}` : null, engine.id.startsWith("x-") ? engine.url.replace(/^https?:\/\//, "") : null]
    .filter(Boolean)
    .join("  ");
  if (sub) {
    const small = document.createElement("small");
    small.textContent = sub;
    name.append(small);
  }

  // Shown means "in the display order and not switched off" - an engine added
  // in a later version isn't in anyone's order yet, so it starts off.
  const box = document.createElement("input");
  box.type = "checkbox";
  box.checked =
    settings.search.order.includes(engine.id) && !(settings.search.hidden || []).includes(engine.id);
  box.setAttribute("aria-label", `Show ${engine.name}`);
  box.addEventListener("change", () => {
    const hidden = new Set(settings.search.hidden);
    if (box.checked) {
      hidden.delete(engine.id);
      if (!settings.search.order.includes(engine.id)) settings.search.order.push(engine.id);
    } else {
      hidden.add(engine.id);
    }
    settings.search.hidden = [...hidden];
    ensureEngine();
    commit();
  });

  li.append(handle, name, box);

  if (engine.id.startsWith("x-")) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-btn";
    remove.setAttribute("aria-label", `Delete ${engine.name}`);
    remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.4 5A1 1 0 0 0 5 6.4L10.6 12 5 17.6A1 1 0 0 0 6.4 19L12 13.4 17.6 19a1 1 0 0 0 1.4-1.4L13.4 12 19 6.4A1 1 0 0 0 17.6 5L12 10.6 6.4 5z"/></svg>';
    remove.addEventListener("click", () => {
      settings.search.custom = settings.search.custom.filter((c) => c.id !== engine.id);
      settings.search.order = settings.search.order.filter((id) => id !== engine.id);
      settings.search.hidden = settings.search.hidden.filter((id) => id !== engine.id);
      ensureEngine();
      renderEngines();
      commit();
    });
    li.append(remove);
  }

  return li;
}

// Never leave the search bar pointing at an engine that is no longer shown.
function ensureEngine() {
  const shown = Engines.visible(settings.search);
  if (shown.length && !shown.some((e) => e.id === settings.search.engine)) {
    settings.search.engine = shown[0].id;
  }
}

function renderEngines() {
  engineList.replaceChildren(...Engines.ordered(settings.search).map(engineRow));
}

sortable(engineList, "li", (from, to) => {
  // Reordering promotes every engine into `order`, so visibility has to be
  // restated through `hidden` or the off ones would quietly switch on.
  const shown = new Set(Engines.visible(settings.search).map((e) => e.id));
  const ids = move(Engines.ordered(settings.search).map((e) => e.id), from, to);
  settings.search.order = ids;
  settings.search.hidden = ids.filter((id) => !shown.has(id));
  renderEngines();
  commit();
});

async function addCustomEngine() {
  const values = await ask({
    title: "Add a custom engine",
    submit: "Add",
    fields: [
      { key: "name", label: "Name", placeholder: "Hacker News" },
      {
        key: "url",
        label: "Search URL",
        placeholder: "https://example.com/search?q=%s",
        hint: "Put %s where your query belongs. Copy a real search URL from the site and swap the words you searched for with %s.",
        mono: true
      },
      {
        key: "bang",
        label: "Bang",
        placeholder: "hn",
        hint: "Type !hn in the search bar to use this engine for one search. Leave empty to skip.",
        mono: true
      }
    ],
    validate: (v) => {
      if (!v.name) return "Give the engine a name.";
      if (!v.url.includes("%s")) return "The URL needs %s where the query goes.";
      const bang = v.bang.replace(/^!/, "").toLowerCase();
      if (bang && Engines.all(settings.search).some((e) => (e.bang || "").toLowerCase() === bang)) {
        return `!${bang} is already taken.`;
      }
      try {
        const u = new URL(v.url.replace("%s", "test"));
        if (!/^https?:$/.test(u.protocol)) return "Use an http or https URL.";
      } catch {
        return "That doesn't look like a web address.";
      }
      return null;
    }
  });
  if (!values) return;

  const engine = {
    id: Engines.customId(values.name),
    name: values.name,
    short: values.name,
    bang: values.bang.replace(/^!/, "").toLowerCase() || Engines.suggestBang(settings.search, values.name),
    hint: `Search ${values.name}`,
    url: values.url
  };
  settings.search.custom.push(engine);
  settings.search.order.push(engine.id);
  settings.search.engine = engine.id;
  renderEngines();
  commit();
}

/* ---- kept prints ---- */

// Thumbnails are re-rendered from the seed rather than stored as images: a
// favorite is 40 bytes, and it can be re-pulled at any size later.
export function renderFavorites() {
  const list = host.favorites?.() || [];
  favEmpty.hidden = list.length > 0;
  favGrid.replaceChildren(
    ...list
      .slice()
      .reverse()
      .map((fav) => {
        const item = document.createElement("div");
        item.className = "fav";

        const cnv = document.createElement("canvas");
        cnv.className = "fav-thumb";
        Wall.renderPreview(cnv, 138, 82, fav.seed, fav.styleId);

        const open = document.createElement("button");
        open.type = "button";
        open.className = "fav-open";
        open.title = `${Wall.describe(fav.seed, fav.styleId)} · ${Wall.seedLabel(fav.seed)}`;
        open.setAttribute("aria-label", `Show ${open.title}`);
        open.addEventListener("click", () => host.showPrint(fav));

        const drop = document.createElement("button");
        drop.type = "button";
        drop.className = "fav-drop";
        drop.setAttribute("aria-label", `Remove ${open.title}`);
        drop.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6.4 5A1 1 0 0 0 5 6.4L10.6 12 5 17.6A1 1 0 0 0 6.4 19L12 13.4 17.6 19a1 1 0 0 0 1.4-1.4L13.4 12 19 6.4A1 1 0 0 0 17.6 5L12 10.6 6.4 5z"/></svg>';
        drop.addEventListener("click", () => host.unfavorite(fav));

        const label = document.createElement("span");
        label.className = "fav-label";
        label.textContent = Wall.seedLabel(fav.seed);

        item.append(cnv, open, drop, label);
        return item;
      })
  );
}

/* ---- open / close ---- */

export function panelOpen() {
  return !panel.hidden;
}

export function closePanel() {
  if (panel.hidden) return;
  panel.classList.add("closing");
  toggleBtn.setAttribute("aria-expanded", "false");
  panel.addEventListener(
    "animationend",
    () => {
      panel.hidden = true;
      panel.classList.remove("closing");
    },
    { once: true }
  );
}

export function togglePanel() {
  if (panel.hidden) {
    panel.classList.remove("closing");
    panel.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    renderEngines();
    renderFavorites();
  } else {
    closePanel();
  }
}

toggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  togglePanel();
});

$("panel-close").addEventListener("click", closePanel);

document.addEventListener("click", (e) => {
  if (panel.hidden || document.querySelector("dialog[open]")) return;
  if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) closePanel();
});

/* ---- mount ---- */

export function mountPanel(config) {
  settings = config.settings;
  commit = config.commit;
  host = config;

  const styleSelect = $("opt-style");
  styleSelect.replaceChildren();
  const auto = new Option("Surprise me", "auto");
  styleSelect.append(auto);
  for (const g of config.styles) styleSelect.append(new Option(g.name, g.id));

  $("add-engine").addEventListener("click", addCustomEngine);
  $("add-pin").addEventListener("click", addPin);
  $("add-note").addEventListener("click", () => {
    if (!settings.notes.enabled) {
      settings.notes.enabled = true;
      commit();
    }
    addNote();
  });

  $("do-export").addEventListener("click", () => host.exportBackup());
  $("do-import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) host.importBackup(file);
  });

  syncPanel();
}

// The settings object is replaced wholesale on import or a cross-tab change.
export function rebind(next) {
  settings = next;
}

// Push the current settings back into every control. Called after each commit
// so controls that depend on one another (engine list, style lock) stay honest.
export function syncPanel() {
  const dim = $("opt-dim");
  dim.value = Math.round(settings.dim * 100);
  dim.oninput = () => {
    settings.dim = Number(dim.value) / 100;
    commit();
  };
  check($("opt-motion"), settings.motion, (v) => {
    settings.motion = v;
    commit();
  });

  check($("opt-clock"), settings.clock.enabled, (v) => {
    settings.clock.enabled = v;
    commit();
  });
  segment($("opt-hour"), settings.clock.hour12 ? "12" : "24", (v) => {
    settings.clock.hour12 = v === "12";
    commit();
  });
  check($("opt-seconds"), settings.clock.seconds, (v) => {
    settings.clock.seconds = v;
    commit();
  });
  check($("opt-date"), settings.clock.date, (v) => {
    settings.clock.date = v;
    commit();
  });

  check($("opt-search"), settings.search.enabled, (v) => {
    settings.search.enabled = v;
    commit();
  });
  check($("opt-autofocus"), settings.search.autofocus, (v) => {
    settings.search.autofocus = v;
    commit();
  });

  check($("opt-pins"), settings.pins.enabled, (v) => {
    settings.pins.enabled = v;
    commit();
  });
  segment($("opt-pinicon"), settings.pins.icons, (v) => {
    settings.pins.icons = v;
    commit();
  });

  check($("opt-notes"), settings.notes.enabled, (v) => {
    settings.notes.enabled = v;
    commit();
  });

  choose($("opt-style"), settings.wallpaper.style, (v) => {
    settings.wallpaper.style = v;
    commit({ rerender: true });
  });
  choose($("opt-cadence"), settings.wallpaper.cadence, (v) => {
    settings.wallpaper.cadence = v;
    commit();
  });
  check($("opt-caption"), settings.wallpaper.annotation, (v) => {
    settings.wallpaper.annotation = v;
    commit();
  });

  if (!panel.hidden) renderEngines();
}
