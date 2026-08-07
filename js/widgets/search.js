// Search bar and the engine strip beneath it.

import * as Engines from "../engines.js";

const form = document.getElementById("search");
const input = document.getElementById("q");
const strip = document.getElementById("engines");

let search = null;
let save = () => {};

// The selected engine may be one that's hidden from the strip - a bang can
// reach any engine. Resolve against the full set, and fall back to the first
// visible one only when the saved id no longer exists at all.
function active() {
  const known = Engines.byId(search, search.engine);
  if (known) return known;
  return Engines.visible(search)[0] || null;
}

// Whatever the person chose, always shown, even if it isn't in the strip list.
function stripEngines() {
  const list = Engines.visible(search);
  const current = active();
  if (current && !list.some((e) => e.id === current.id)) list.push(current);
  return list;
}

function paintStrip() {
  const current = active();
  strip.replaceChildren(
    ...stripEngines().map((engine) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "eng";
      b.setAttribute("role", "tab");
      b.dataset.id = engine.id;
      b.textContent = engine.short || engine.name;
      b.setAttribute("aria-selected", String(engine.id === current?.id));
      b.title = engine.bang ? `${engine.name}  !${engine.bang}` : engine.name;
      return b;
    })
  );
  input.placeholder = current ? `${current.hint}…` : "Add an engine in settings…";
}

function setEngine(id, { focus = false } = {}) {
  search.engine = id;
  save();
  paintStrip();
  if (focus) input.focus();
}

function cycle(step) {
  const list = stripEngines();
  if (list.length < 2) return;
  const i = list.findIndex((e) => e.id === active()?.id);
  setEngine(list[(i + step + list.length) % list.length].id);
}

export function updateSearch(next, onSave) {
  search = next;
  save = onSave;
  form.hidden = !search.enabled;
  if (search.enabled) paintStrip();
}

export function focusSearch() {
  if (form.hidden) return;
  input.focus();
  input.select();
}

// Called once at startup: Chrome hands focus to the omnibox on a new tab, so
// taking it is opt-in.
export function maybeAutofocus() {
  if (!form.hidden && search.autofocus) input.focus();
}

strip.addEventListener("click", (e) => {
  const b = e.target.closest(".eng");
  if (b) setEngine(b.dataset.id, { focus: true });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  // a bang typed without a trailing space still counts on submit
  const bang = Engines.resolveBang(search, input.value.trim());
  if (bang) {
    setEngine(bang.engine.id);
    input.value = bang.rest;
    if (!bang.rest) return;
  }
  const query = input.value.trim();
  const engine = active();
  if (query && engine) location.href = Engines.buildUrl(engine, query);
});

// Bangs resolve as you type: "!gh " switches to GitHub and disappears from the
// field, so what's left is exactly the query.
input.addEventListener("input", () => {
  const bang = Engines.resolveBang(search, input.value);
  if (bang?.complete) {
    input.value = bang.rest;
    if (bang.engine.id !== search.engine) setEngine(bang.engine.id);
  }
});

// Tab hops to the next engine, but only once you've typed something - with an
// empty field it stays ordinary Tab so the page never traps keyboard focus.
input.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && input.value.trim() && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    cycle(e.shiftKey ? -1 : 1);
  } else if (e.key === "Escape") {
    input.blur();
  }
});
