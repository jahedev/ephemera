// Sticky notes.
//
// Positions are stored as fractions of the free space rather than pixels, so a
// note pinned to the right edge stays on the right edge when the window
// changes size - and can never end up parked outside the viewport.

import { debounce } from "../store.js";

const layer = document.getElementById("notes");

const COLORS = [
  { h: 44, s: 1 },
  { h: 150, s: 1 },
  { h: 200, s: 1 },
  { h: 268, s: 1 },
  { h: 342, s: 1 },
  { h: 250, s: 0.1 }
];

const DEL = "M6.4 5A1 1 0 0 0 5 6.4L10.6 12 5 17.6A1 1 0 0 0 6.4 19L12 13.4 17.6 19a1 1 0 0 0 1.4-1.4L13.4 12 19 6.4A1 1 0 0 0 17.6 5L12 10.6 6.4 5z";

let notes = [];
let enabled = true;
let persist = () => {};
let top = 1;

const persistSoon = debounce(() => persist(notes), 400);

function freeSpace(note) {
  return {
    x: Math.max(0, innerWidth - note.w),
    y: Math.max(0, innerHeight - note.h)
  };
}

function place(el, note) {
  const free = freeSpace(note);
  el.style.left = `${note.fx * free.x}px`;
  el.style.top = `${note.fy * free.y}px`;
  el.style.width = `${note.w}px`;
  el.style.height = `${note.h}px`;
}

function paintColor(el, note) {
  const c = COLORS[note.c] || COLORS[0];
  el.style.setProperty("--note-h", c.h);
  el.style.setProperty("--note-s", c.s);
  for (const sw of el.querySelectorAll(".swatch")) {
    sw.setAttribute("aria-pressed", String(Number(sw.dataset.c) === note.c));
  }
}

function build(note) {
  const el = document.createElement("div");
  el.className = "note";
  el.dataset.id = note.id;
  el.style.setProperty("--rot", `${note.rot}deg`);
  el.style.zIndex = ++top;

  const bar = document.createElement("div");
  bar.className = "note-bar";

  const tools = document.createElement("div");
  tools.className = "note-tools";

  const swatches = document.createElement("div");
  swatches.className = "swatches";
  COLORS.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.c = i;
    b.style.setProperty("--sw-h", c.h);
    b.style.setProperty("--sw-s", c.s);
    b.setAttribute("aria-label", `Colour ${i + 1}`);
    swatches.append(b);
  });

  const del = document.createElement("button");
  del.type = "button";
  del.className = "note-del";
  del.setAttribute("aria-label", "Delete note");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", DEL);
  svg.append(path);
  del.append(svg);

  tools.append(swatches, del);

  const text = document.createElement("textarea");
  text.value = note.text || "";
  text.placeholder = "Type a note";
  text.spellcheck = false;

  const grip = document.createElement("div");
  grip.className = "note-grip";

  el.append(bar, tools, text, grip);
  paintColor(el, note);
  place(el, note);

  text.addEventListener("input", () => {
    note.text = text.value;
    persistSoon();
  });

  swatches.addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    note.c = Number(b.dataset.c);
    paintColor(el, note);
    persist(notes);
  });

  del.addEventListener("click", () => remove(note, el));

  el.addEventListener("pointerdown", (e) => {
    el.style.zIndex = ++top;
    if (e.target.closest("textarea, button")) return;
    if (e.target.classList.contains("note-grip")) startResize(e, el, note);
    else startDrag(e, el, note);
  });

  return el;
}

function startDrag(e, el, note) {
  e.preventDefault();
  const box = el.getBoundingClientRect();
  const dx = e.clientX - box.left;
  const dy = e.clientY - box.top;
  el.setPointerCapture(e.pointerId);
  el.classList.add("dragging");

  const onMove = (ev) => {
    const free = freeSpace(note);
    const x = Math.min(Math.max(0, ev.clientX - dx), free.x);
    const y = Math.min(Math.max(0, ev.clientY - dy), free.y);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    note.fx = free.x ? x / free.x : 0;
    note.fy = free.y ? y / free.y : 0;
  };

  const onUp = () => {
    el.classList.remove("dragging");
    el.removeEventListener("pointermove", onMove);
    persist(notes);
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp, { once: true });
  el.addEventListener("pointercancel", onUp, { once: true });
}

function startResize(e, el, note) {
  e.preventDefault();
  e.stopPropagation();
  const box = el.getBoundingClientRect();
  const x0 = e.clientX;
  const y0 = e.clientY;
  el.setPointerCapture(e.pointerId);

  const onMove = (ev) => {
    note.w = Math.round(Math.min(Math.max(150, box.width + ev.clientX - x0), innerWidth - 40));
    note.h = Math.round(Math.min(Math.max(110, box.height + ev.clientY - y0), innerHeight - 40));
    place(el, note);
  };

  const onUp = () => {
    el.removeEventListener("pointermove", onMove);
    persist(notes);
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp, { once: true });
  el.addEventListener("pointercancel", onUp, { once: true });
}

function remove(note, el) {
  el.classList.add("leaving");
  el.addEventListener("animationend", () => el.remove(), { once: true });
  notes = notes.filter((n) => n !== note);
  persist(notes);
}

export function addNote() {
  // stagger new notes down the right-hand side instead of stacking them
  const n = notes.length;
  const note = {
    id: `n${Date.now().toString(36)}${n}`,
    fx: 0.95 - (n % 2) * 0.11,
    fy: 0.09 + (n % 3) * 0.27,
    w: 216,
    h: 168,
    c: n % COLORS.length,
    rot: Math.round((Math.random() * 4.4 - 2.2) * 10) / 10,
    text: ""
  };
  notes.push(note);
  const el = build(note);
  layer.append(el);
  persist(notes);
  el.querySelector("textarea").focus();
  return note;
}

export function renderNotes() {
  layer.hidden = !enabled;
  if (!enabled) return;
  layer.replaceChildren(...notes.map(build));
}

export function relayoutNotes() {
  for (const el of layer.querySelectorAll(".note")) {
    const note = notes.find((n) => n.id === el.dataset.id);
    if (note) place(el, note);
  }
}

// Only rebuild the DOM when the notes themselves change - a settings tweak
// shouldn't yank the cursor out of a note you're typing in.
export function updateNotes({ list, on, onSave }) {
  const was = enabled;
  if (list) notes = list;
  enabled = on;
  persist = onSave;
  if (list || was !== on) renderNotes();
}
