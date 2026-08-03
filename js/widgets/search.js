// Search bar and the engine strip beneath it.

import * as Engines from "../engines.js";

const form = document.getElementById("search");
const input = document.getElementById("q");
const strip = document.getElementById("engines");

let search = null;
let save = () => {};

function active() {
  const list = Engines.visible(search);
  if (!list.length) return null;
  return list.find((e) => e.id === search.engine) || list[0];
}

function paintStrip() {
  const list = Engines.visible(search);
  const current = active();
  strip.replaceChildren(
    ...list.map((engine) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "eng";
      b.setAttribute("role", "tab");
      b.dataset.id = engine.id;
      b.textContent = engine.short || engine.name;
      b.setAttribute("aria-selected", String(engine.id === current?.id));
      b.title = engine.name;
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
  const list = Engines.visible(search);
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

strip.addEventListener("click", (e) => {
  const b = e.target.closest(".eng");
  if (b) setEngine(b.dataset.id, { focus: true });
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = input.value.trim();
  const engine = active();
  if (query && engine) location.href = Engines.buildUrl(engine, query);
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
