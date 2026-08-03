// Pinned sites.
//
// Tile icons come from the browser's own favicon store via the MV3 _favicon
// endpoint, which keeps the page's no-network promise intact. Anywhere that
// isn't available - development preview, or a site the browser has never seen
// - a monogram tile stands in, tinted from the hostname so the same site keeps
// the same colour.

import { ask } from "../ui/dialog.js";
import { sortable, move } from "../ui/sortable.js";

const nav = document.getElementById("pins");

let pins = null;
let save = () => {};

const ICONS = {
  edit: "M14.06 3.94a1.5 1.5 0 0 1 2.12 0l1.88 1.88a1.5 1.5 0 0 1 0 2.12L9.5 16.5 5 18l1.5-4.5 7.56-7.56zM4 20h16v1.6H4V20z",
  remove: "M6.4 5A1 1 0 0 0 5 6.4L10.6 12 5 17.6A1 1 0 0 0 6.4 19L12 13.4 17.6 19a1 1 0 0 0 1.4-1.4L13.4 12 19 6.4A1 1 0 0 0 17.6 5L12 10.6 6.4 5z",
  add: "M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1z"
};

function icon(path, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  if (cls) svg.setAttribute("class", cls);
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", path);
  svg.append(p);
  return svg;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function hue(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
  return h;
}

function faviconUrl(url) {
  if (typeof chrome === "undefined" || !chrome.runtime?.getURL) return null;
  try {
    const u = new URL(chrome.runtime.getURL("/_favicon/"));
    u.searchParams.set("pageUrl", url);
    u.searchParams.set("size", "64");
    return u.toString();
  } catch {
    return null;
  }
}

function normalize(raw) {
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  new URL(url); // throws if still unusable
  return url;
}

function monogram(pin) {
  const span = document.createElement("span");
  span.className = "pin-mono";
  span.textContent = (pin.title || hostOf(pin.url) || "?").trim().charAt(0).toUpperCase();
  span.style.setProperty("--pin-h", hue(hostOf(pin.url)));
  return span;
}

function tile(pin, index) {
  const a = document.createElement("a");
  a.className = "pin";
  a.href = pin.url;
  a.draggable = true;
  a.dataset.index = index;
  a.title = pin.url;

  const box = document.createElement("span");
  box.className = "pin-icon";

  const src = pins.icons === "favicon" ? faviconUrl(pin.url) : null;
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.addEventListener("error", () => box.replaceChildren(monogram(pin)), { once: true });
    box.append(img);
  } else {
    box.append(monogram(pin));
  }

  const label = document.createElement("span");
  label.className = "pin-label";
  label.textContent = pin.title || hostOf(pin.url);

  const tools = document.createElement("span");
  tools.className = "pin-edit";
  for (const [action, path, aria] of [
    ["edit", ICONS.edit, "Edit"],
    ["remove", ICONS.remove, "Remove"]
  ]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.action = action;
    b.setAttribute("aria-label", `${aria} ${pin.title || hostOf(pin.url)}`);
    b.append(icon(path));
    tools.append(b);
  }

  a.append(box, label, tools);
  return a;
}

function addTile() {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pin add";
  b.id = "pin-add";

  const box = document.createElement("span");
  box.className = "pin-icon";
  box.append(icon(ICONS.add));

  const label = document.createElement("span");
  label.className = "pin-label";
  label.textContent = "Add";

  b.append(box, label);
  return b;
}

export function renderPins() {
  nav.hidden = !pins.enabled;
  if (!pins.enabled) return;
  nav.replaceChildren(...pins.items.map(tile), addTile());
}

async function edit(index) {
  const existing = index >= 0 ? pins.items[index] : null;
  const values = await ask({
    title: existing ? "Edit site" : "Add a site",
    submit: existing ? "Save" : "Add",
    fields: [
      { key: "url", label: "Address", value: existing?.url || "", placeholder: "example.com", mono: true },
      { key: "title", label: "Name", value: existing?.title || "", placeholder: "Leave empty to use the domain" }
    ],
    validate: (v) => {
      if (!v.url) return "Enter an address.";
      try {
        normalize(v.url);
        return null;
      } catch {
        return "That doesn't look like a web address.";
      }
    }
  });
  if (!values) return;

  const pin = { url: normalize(values.url), title: values.title || hostOf(normalize(values.url)) };
  if (existing) pins.items[index] = pin;
  else pins.items.push(pin);
  save();
  renderPins();
}

export function addPin() {
  return edit(-1);
}

export function updatePins(next, onSave) {
  pins = next;
  save = onSave;
  renderPins();
}

nav.addEventListener("click", (e) => {
  if (e.target.closest("#pin-add")) {
    e.preventDefault();
    addPin();
    return;
  }
  const action = e.target.closest("[data-action]");
  if (!action) return;
  e.preventDefault();
  const index = Number(action.closest(".pin").dataset.index);
  if (action.dataset.action === "edit") {
    edit(index);
  } else {
    pins.items.splice(index, 1);
    save();
    renderPins();
  }
});

sortable(
  nav,
  ".pin:not(.add)",
  (from, to) => {
    pins.items = move(pins.items, from, to);
    save();
    renderPins();
  },
  "x"
);
