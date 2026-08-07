// The print itself: choosing one, painting it, crossfading between them, and
// re-rendering the visible image at 4K on demand.
//
// Two stacked canvases take turns. The incoming one is drawn while hidden,
// raised above its predecessor, then faded in - so a shuffle dissolves instead
// of blinking, and the outgoing image never shows through.

import { PALETTES } from "./art/palettes.js";
import { GENERATORS } from "./art/generators.js";
import { mulberry32, randomSeed, rgb } from "./art/util.js";

const root = document.documentElement;
const layers = [document.getElementById("wall-a"), document.getElementById("wall-b")];
const wash = document.getElementById("wash");

let front = -1;
let z = 1;
let palette = PALETTES[0];
let current = { seed: 0, styleId: GENERATORS[0].id };

export function styles() {
  return GENERATORS;
}

export function state() {
  return { ...current };
}

// The palette is the very first draw off the seeded rng, so it can be known
// before the (much heavier) generator runs. That's what lets the page paint a
// matching background wash immediately.
export function paletteFor(seed) {
  const rng = mulberry32(seed);
  return PALETTES[Math.floor(rng() * PALETTES.length)];
}

const luma = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Pick the palette entry that will read as an accent against the dark chrome.
// Palettes are ordered dark to light, but their ranges differ, so match on
// luminance rather than trusting an index.
function accentOf(pal) {
  const target = 0.7;
  let best = pal.colors[pal.colors.length - 1];
  let dist = Infinity;
  for (const hex of pal.colors) {
    const d = Math.abs(luma(rgb(hex)) - target);
    if (d < dist) { dist = d; best = hex; }
  }
  return rgb(best);
}

const triple = (c) => `${c[0] | 0} ${c[1] | 0} ${c[2] | 0}`;

export function applyAccent() {
  const accent = accentOf(palette);
  root.style.setProperty("--accent", triple(accent));
  // whatever sits on top of a solid accent fill has to stay readable, and the
  // accent changes with every print
  root.style.setProperty("--accent-ink", luma(accent) > 0.55 ? "18 16 24" : "252 251 249");
}

// Instant, sub-millisecond stand-in for the real print, so the tab is never
// blank while a generator runs.
export function paintWash(seed) {
  palette = paletteFor(seed);
  wash.style.setProperty("--wash-a", triple(rgb(palette.colors[0])));
  wash.style.setProperty("--wash-b", triple(rgb(palette.colors[1])));
}

// Same (seed, styleId, cssW, cssH) always produces the same image, which is
// what lets the download path re-render exactly what you're looking at.
function renderTo(cnv, cssW, cssH, pxScale, seed, styleId) {
  cnv.width = Math.round(cssW * pxScale);
  cnv.height = Math.round(cssH * pxScale);
  const ctx = cnv.getContext("2d");
  ctx.save();
  ctx.scale(pxScale, pxScale);
  const rng = mulberry32(seed);
  const pal = PALETTES[Math.floor(rng() * PALETTES.length)];
  const gen = GENERATORS.find((g) => g.id === styleId) || GENERATORS[0];
  gen.draw(ctx, cssW, cssH, rng, pal, pxScale);
  ctx.restore();
  return { pal, gen };
}

export function show(seed, styleId) {
  current = { seed, styleId };
  palette = paletteFor(seed);

  const back = layers[front === 0 ? 1 : 0];
  const info = renderTo(back, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2), seed, styleId);

  applyAccent();
  back.style.zIndex = ++z;
  back.getBoundingClientRect(); // flush, so the fade actually animates
  back.classList.add("on");
  if (front >= 0) layers[front].classList.remove("on");
  front = layers.indexOf(back);
  return info;
}

export function redraw() {
  if (front < 0) return;
  renderTo(layers[front], innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2), current.seed, current.styleId);
}

export function download() {
  return new Promise((resolve, reject) => {
    // let the spinner paint before the heavy synchronous render
    setTimeout(() => {
      try {
        const w = innerWidth;
        const h = innerHeight;
        const k = Math.max(3840 / w, 2160 / h, devicePixelRatio || 1);
        const off = document.createElement("canvas");
        renderTo(off, w, h, k, current.seed, current.styleId);
        off.toBlob((blob) => {
          if (!blob) return reject(new Error("Could not encode the image"));
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `ephemera-${current.styleId}-${seedLabel(current.seed)}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve();
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    }, 40);
  });
}

// Small preview of a stored print, for the favorites grid.
export function renderPreview(cnv, w, h, seed, styleId) {
  return renderTo(cnv, w, h, Math.min(devicePixelRatio || 1, 2), seed, styleId);
}

export function describe(seed, styleId) {
  const rng = mulberry32(seed);
  const pal = PALETTES[Math.floor(rng() * PALETTES.length)];
  const gen = GENERATORS.find((g) => g.id === styleId) || GENERATORS[0];
  return `${gen.name} on ${pal.name}`;
}

export function seedLabel(seed) {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(-6);
}

function validStyle(id) {
  return GENERATORS.some((g) => g.id === id);
}

function pickStyle(pref) {
  if (pref !== "auto" && validStyle(pref)) return pref;
  return GENERATORS[Math.floor(Math.random() * GENERATORS.length)].id;
}

// Whether to reuse the saved print or pull a new one, per the chosen cadence.
export function decide(wallpaper, saved) {
  const fresh = () => ({ seed: randomSeed(), styleId: pickStyle(wallpaper.style), at: Date.now() });
  const { cadence, style } = wallpaper;

  if (cadence === "tab") return fresh();
  if (!saved || !Number.isFinite(saved.seed) || !validStyle(saved.styleId)) return fresh();
  if (style !== "auto" && saved.styleId !== style) return fresh();

  const now = new Date();
  const then = new Date(saved.at || 0);
  if (cadence === "hour" && (now - then >= 3600000 || now.getHours() !== then.getHours())) return fresh();
  if (cadence === "day" && now.toDateString() !== then.toDateString()) return fresh();

  return { ...saved };
}

export function fresh(wallpaper) {
  return { seed: randomSeed(), styleId: pickStyle(wallpaper.style), at: Date.now() };
}
