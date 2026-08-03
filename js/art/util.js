export const TAU = Math.PI * 2;

// Deterministic PRNG - every wallpaper is reproducible from its seed,
// which lets the download button re-render the exact same image at 4K.
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0];
}

export const rr = (rng, a, b) => a + rng() * (b - a);
export const ri = (rng, a, b) => Math.floor(a + rng() * (b - a + 1));
export const pick = (rng, arr) => arr[(rng() * arr.length) | 0];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Colors are [r, g, b] arrays throughout the generators.
export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// t < 0 darkens toward black, t > 0 lightens toward white
export function shade(c, t) {
  return t < 0 ? mix(c, [0, 0, 0], -t) : mix(c, [255, 255, 255], t);
}

export function css(c, a) {
  const r = c[0] | 0, g = c[1] | 0, b = c[2] | 0;
  return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

// Sample a multi-stop gradient of palette colors at t in [0, 1]
export function sampleGrad(C, t) {
  t = clamp(t, 0, 1) * (C.length - 1);
  const i = Math.floor(t);
  if (i >= C.length - 1) return C[C.length - 1];
  return mix(C[i], C[i + 1], t - i);
}
