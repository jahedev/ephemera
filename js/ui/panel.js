// Settings panel wiring. Every control writes straight into the settings
// object and calls commit(), which saves and re-applies.

import * as Engines from "../engines.js";
import { ask } from "./dialog.js";
import { sortable, move } from "./sortable.js";
import { addPin } from "../widgets/pins.js";
import { addNote } from "../widgets/notes.js";

const panel = document.getElementById("panel");
const toggleBtn = document.getElementById("btn-settings");
const engineList = document.getElementById("engine-list");

const $ = (id) => document.getElementById(id);

let settings = null;
let commit = () => {};

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
  if (engine.id.startsWith("x-")) {
    const small = document.createElement("small");
    small.textContent = engine.url.replace(/^https?:\/\//, "");
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
      }
    ],
    validate: (v) => {
      if (!v.name) return "Give the engine a name.";
      if (!v.url.includes("%s")) return "The URL needs %s where the query goes.";
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
    hint: `Search ${values.name}`,
    url: values.url
  };
  settings.search.custom.push(engine);
  settings.search.order.push(engine.id);
  settings.search.engine = engine.id;
  renderEngines();
  commit();
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

  syncPanel();
}

// Push the current settings back into every control. Called after each commit
// so controls that depend on one another (engine list, style lock) stay honest.
export function syncPanel() {
  segment($("opt-theme"), settings.theme, (v) => {
    settings.theme = v;
    commit();
  });
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
