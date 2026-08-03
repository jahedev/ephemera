// The wallpaper generators. Each draw() receives a 2D context already scaled
// so that (w, h) are logical CSS pixels, a seeded rng, a palette, and px
// (physical pixels per logical unit, used only to size per-pixel buffers).
// All randomness must come from rng so a wallpaper can be re-rendered
// identically at a higher resolution for download.

import { TAU, rr, ri, pick, clamp, smoothstep, rgb, css, mix, shade, sampleGrad } from "./util.js";
import { makeNoise2D, makeFbm } from "./noise.js";
import { grain, vignette, drawStars } from "./post.js";

// ---- Silk: glowing flow-field threads ----
function drawSilk(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, css(shade(C[0], -0.45)));
  bg.addColorStop(1, css(shade(mix(C[0], C[1], 0.6), -0.6)));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const noise = makeNoise2D(rng);
  const m = Math.min(w, h);
  const ns = rr(rng, 1.4, 3.0) / m;
  const curl = rr(rng, 2.0, 4.0);
  const steps = ri(rng, 28, 60);
  const step = m * rr(rng, 0.0035, 0.006);
  const count = Math.round((w * h) / rr(rng, 700, 1200));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    let x = rr(rng, -0.1, 1.1) * w;
    let y = rr(rng, -0.1, 1.1) * h;
    const t = clamp(0.5 + 0.5 * noise(x * ns * 0.6 + 37.2, y * ns * 0.6 - 11.8), 0, 1);
    const col = sampleGrad(C, 0.35 + 0.65 * t);
    ctx.strokeStyle = css(col, rr(rng, 0.09, 0.2));
    ctx.lineWidth = rr(rng, 0.7, 2.2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const a = noise(x * ns, y * ns) * Math.PI * curl;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  vignette(ctx, w, h, 0.3);
  grain(ctx, w, h, 0.05, rng);
}

// ---- Bloom: soft mesh-gradient orbs ----
function drawBloom(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  // Paint at 1/3 resolution then upscale for extra softness
  const oW = Math.max(2, Math.round(w / 3));
  const oH = Math.max(2, Math.round(h / 3));
  const off = document.createElement("canvas");
  off.width = oW;
  off.height = oH;
  const o = off.getContext("2d");

  o.fillStyle = css(C[ri(rng, 0, 1)]);
  o.fillRect(0, 0, oW, oH);

  const n = ri(rng, 6, 10);
  for (let i = 0; i < n; i++) {
    const col = C[ri(rng, 1, C.length - 1)];
    const x = rr(rng, -0.15, 1.15) * oW;
    const y = rr(rng, -0.15, 1.15) * oH;
    const r = rr(rng, 0.3, 0.75) * Math.max(oW, oH);
    const g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(col, rr(rng, 0.6, 0.95)));
    g.addColorStop(1, css(col, 0));
    o.globalCompositeOperation = rng() < 0.25 ? "lighter" : "source-over";
    o.fillStyle = g;
    o.fillRect(0, 0, oW, oH);
  }
  // a few small vivid accents for focal interest
  const na = ri(rng, 2, 4);
  o.globalCompositeOperation = "source-over";
  for (let i = 0; i < na; i++) {
    const col = C[ri(rng, 2, C.length - 1)];
    const x = rr(rng, 0.1, 0.9) * oW;
    const y = rr(rng, 0.1, 0.9) * oH;
    const r = rr(rng, 0.1, 0.24) * Math.max(oW, oH);
    const g = o.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, css(col, rr(rng, 0.5, 0.8)));
    g.addColorStop(1, css(col, 0));
    o.fillStyle = g;
    o.fillRect(0, 0, oW, oH);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, w, h);
  ctx.restore();
  vignette(ctx, w, h, 0.18);
  grain(ctx, w, h, 0.09, rng);
}

// ---- Highlands: layered mountain ridges at dusk or night ----
function drawHighlands(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const noise = makeNoise2D(rng);
  const fbm = makeFbm(noise, 4, 2, 0.5);
  const night = rng() < 0.38;
  const horizon = h * rr(rng, 0.42, 0.55);

  const sky = ctx.createLinearGradient(0, 0, 0, horizon * 1.4);
  if (night) {
    sky.addColorStop(0, css(shade(C[0], -0.55)));
    sky.addColorStop(1, css(mix(C[0], C[1], 0.75)));
  } else {
    sky.addColorStop(0, css(mix(C[2], C[3], 0.4)));
    sky.addColorStop(1, css(mix(C[3], C[4], 0.7)));
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (night) drawStars(ctx, w, horizon, rng, Math.round((w * horizon) / 4500));

  // sun or moon with glow
  const sx = rr(rng, 0.2, 0.8) * w;
  const sy = rr(rng, 0.3, 0.85) * horizon;
  const sr = Math.min(w, h) * rr(rng, 0.04, 0.09);
  const scol = night ? [235, 235, 225] : mix(C[4], [255, 255, 255], 0.5);
  const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 6);
  glow.addColorStop(0, css(scol, 0.5));
  glow.addColorStop(1, css(scol, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = css(scol, night ? 0.95 : 1);
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, TAU);
  ctx.fill();

  // ridge layers, hazy in back to dark in front
  const L = ri(rng, 4, 6);
  const haze = night ? mix(C[1], C[2], 0.5) : mix(C[3], C[2], 0.55);
  const deep = shade(C[0], night ? -0.7 : -0.4);
  for (let i = 0; i < L; i++) {
    const p = L === 1 ? 0 : i / (L - 1);
    const yb = horizon + (h * 0.9 - horizon) * p;
    const amp = h * rr(rng, 0.03, 0.09) * (0.5 + p);
    const f = rr(rng, 1.0, 2.4) / w;
    const col = mix(haze, deep, Math.pow((i + 1) / L, 1.15));
    ctx.fillStyle = css(col);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) {
      ctx.lineTo(x, yb + fbm(x * f, i * 13.7 + 4.2) * amp * 2);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  vignette(ctx, w, h, 0.22);
  grain(ctx, w, h, 0.045, rng);
}

// ---- Aurora: curtains of light over a dark landscape ----
function drawAurora(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const noise = makeNoise2D(rng);
  const fbm = makeFbm(noise, 3, 2, 0.55);

  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, css(shade(C[0], -0.72)));
  bg.addColorStop(1, css(shade(mix(C[0], C[1], 0.6), -0.45)));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  drawStars(ctx, w, h * 0.9, rng, Math.round((w * h) / 3800));

  const nc = ri(rng, 2, 4);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let c = 0; c < nc; c++) {
    const colA = C[ri(rng, 2, 4)];
    const colB = C[ri(rng, 2, 4)];
    const baseTop = h * rr(rng, 0.06, 0.34);
    const wob = h * rr(rng, 0.06, 0.18);
    const lenB = h * rr(rng, 0.2, 0.42);
    const aB = rr(rng, 0.28, 0.5) / Math.sqrt(nc);
    const sc = rr(rng, 1.4, 3.2);
    const ff = rr(rng, 25, 60); // fine vertical fold frequency
    const zc = c * 17.3;
    for (let x = 0; x <= w; x += 2) {
      const u = x / w;
      const t0 = baseTop + fbm(u * sc, zc) * wob * 2;
      const len = lenB * (0.5 + 0.5 * (0.5 + 0.5 * fbm(u * sc * 1.7 + 7.7, zc + 5.1)));
      const fold = 0.5 + 0.5 * noise(u * ff, zc);
      const a = aB * (0.25 + 0.75 * fold * fold) * Math.pow(Math.sin(Math.PI * u), 0.3);
      const g = ctx.createLinearGradient(0, t0, 0, t0 + len);
      g.addColorStop(0, css(colB, 0));
      g.addColorStop(0.55, css(colB, a * 0.45));
      g.addColorStop(0.9, css(colA, a));
      g.addColorStop(1, css(colA, a * 0.75));
      ctx.fillStyle = g;
      ctx.fillRect(x - 1, t0, 2.4, len);
    }
  }
  ctx.restore();

  // dark ground silhouette
  ctx.fillStyle = css(shade(C[0], -0.85));
  ctx.beginPath();
  ctx.moveTo(0, h);
  const gf = rr(rng, 1.2, 2.5) / w;
  const gb = h * rr(rng, 0.88, 0.94);
  for (let x = 0; x <= w; x += 3) {
    ctx.lineTo(x, gb + fbm(x * gf, 99.1) * h * 0.05);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  vignette(ctx, w, h, 0.25);
  grain(ctx, w, h, 0.05, rng);
}

// ---- Facets: low-poly triangle mesh over a color field ----
function drawFacets(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const noise = makeNoise2D(rng);
  const cols = ri(rng, 9, 15);
  const cw = w / cols;
  const rows = Math.max(2, Math.round(h / cw));
  const ch = h / rows;
  const jx = cw * 0.38;
  const jy = ch * 0.38;

  const pts = [];
  for (let r = 0; r <= rows; r++) {
    pts[r] = [];
    for (let c = 0; c <= cols; c++) {
      let x = c * cw + rr(rng, -jx, jx);
      let y = r * ch + rr(rng, -jy, jy);
      if (c === 0) x = 0;
      if (c === cols) x = w;
      if (r === 0) y = 0;
      if (r === rows) y = h;
      pts[r][c] = [x, y];
    }
  }

  const ang = rr(rng, 0, TAU);
  const ux = Math.cos(ang);
  const uy = Math.sin(ang);
  const ns = rr(rng, 1.2, 2.5);

  const tri = (p1, p2, p3) => {
    const cx = (p1[0] + p2[0] + p3[0]) / 3;
    const cy = (p1[1] + p2[1] + p3[1]) / 3;
    let t = 0.5 + ((cx / w - 0.5) * ux + (cy / h - 0.5) * uy) * 0.9;
    t += noise((cx / w) * ns, (cy / h) * ns) * 0.14 + rr(rng, -0.045, 0.045);
    const col = shade(sampleGrad(C, clamp(t, 0, 1)), rr(rng, -0.07, 0.07));
    ctx.fillStyle = css(col);
    ctx.strokeStyle = css(col); // stroke hides antialias seams
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c], b = pts[r][c + 1];
      const d = pts[r + 1][c], e = pts[r + 1][c + 1];
      if (rng() < 0.5) {
        tri(a, b, e);
        tri(a, e, d);
      } else {
        tri(a, b, d);
        tri(b, e, d);
      }
    }
  }
  grain(ctx, w, h, 0.045, rng);
  vignette(ctx, w, h, 0.16);
}

// ---- Nebula: domain-warped fbm clouds with a starfield ----
function drawNebula(ctx, w, h, rng, pal, px) {
  const C = pal.colors.map(rgb);
  const noise = makeNoise2D(rng);
  const fbm3 = makeFbm(noise, 3, 2.1, 0.55);
  const fbm4 = makeFbm(noise, 4, 2.05, 0.5);

  // Per-pixel pass runs on a smaller buffer; clouds are soft so upscaling is free
  const oW = Math.max(240, Math.min(1000, Math.round(w * px * 0.26)));
  const oH = Math.max(2, Math.round((oW * h) / w));
  const off = document.createElement("canvas");
  off.width = oW;
  off.height = oH;
  const octx = off.getContext("2d");
  const img = octx.createImageData(oW, oH);

  const asp = w / h;
  const s1 = rr(rng, 1.2, 2.2);
  const warp = rr(rng, 0.35, 0.8);
  const o1 = rr(rng, 0, 90), o2 = rr(rng, 0, 90);
  const o3 = rr(rng, 0, 90), o4 = rr(rng, 0, 90);
  const bg = shade(C[0], -0.72);
  const cA = C[2];
  const cB = C[ri(rng, 3, 4)];
  const inten = rr(rng, 0.75, 1.05);

  const d = img.data;
  let idx = 0;
  for (let y = 0; y < oH; y++) {
    const v = y / oH;
    for (let x = 0; x < oW; x++) {
      const u = (x / oW) * asp;
      const wx = fbm3(u * s1 + o1, v * s1 + o2);
      const wy = fbm3(u * s1 + o3, v * s1 + o4);
      const n = fbm4(u * s1 + wx * warp + o1 * 0.6, v * s1 + wy * warp + o2 * 0.6);
      const dv = clamp(0.5 + 0.5 * n * 1.2, 0, 1);
      // large-scale clearing mask keeps parts of the sky dark and starry
      const mask = smoothstep(-0.6, 0.35, wx);
      const cloud = smoothstep(0.45, 0.95, dv) * inten * 0.85 * mask;
      const hi = smoothstep(0.8, 0.98, dv) * inten * mask;
      const m = clamp(0.5 + 0.5 * wy * 1.3, 0, 1);
      d[idx] = clamp(bg[0] + (cA[0] + (cB[0] - cA[0]) * m) * cloud + 45 * hi, 0, 255);
      d[idx + 1] = clamp(bg[1] + (cA[1] + (cB[1] - cA[1]) * m) * cloud + 45 * hi, 0, 255);
      d[idx + 2] = clamp(bg[2] + (cA[2] + (cB[2] - cA[2]) * m) * cloud + 45 * hi, 0, 255);
      d[idx + 3] = 255;
      idx += 4;
    }
  }
  octx.putImageData(img, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(off, 0, 0, w, h);
  ctx.restore();

  drawStars(ctx, w, h, rng, Math.round((w * h) / 2600));

  // a few bright stars with glow and diffraction spikes
  const nb = ri(rng, 6, 14);
  for (let i = 0; i < nb; i++) {
    const x = rr(rng, 0.05, 0.95) * w;
    const y = rr(rng, 0.05, 0.95) * h;
    const r = rr(rng, 1.2, 2.6);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(0.25, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - r * 5, y);
    ctx.lineTo(x + r * 5, y);
    ctx.moveTo(x, y - r * 5);
    ctx.lineTo(x, y + r * 5);
    ctx.stroke();
  }
  vignette(ctx, w, h, 0.32);
  grain(ctx, w, h, 0.05, rng);
}

// ---- Conduit: truchet arc tiles ----
function drawConduit(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const dark = rng() < 0.6;
  const bg = dark ? shade(C[0], -0.25) : shade(C[4], 0.25);
  const fg = dark ? mix(C[3], C[4], 0.4) : shade(C[1], -0.1);
  const accent = C[2];
  ctx.fillStyle = css(bg);
  ctx.fillRect(0, 0, w, h);

  const n = ri(rng, 8, 16);
  const cell = w / n;
  const rows = Math.ceil(h / cell);
  ctx.lineWidth = cell * rr(rng, 0.13, 0.24);
  ctx.lineCap = "butt";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < n; c++) {
      if (rng() < 0.03) continue;
      const x = c * cell;
      const y = r * cell;
      const col = rng() < 0.08 ? accent : fg;
      ctx.strokeStyle = css(col, dark ? rr(rng, 0.55, 0.95) : rr(rng, 0.7, 1));
      if (rng() < 0.5) {
        ctx.beginPath();
        ctx.arc(x, y, cell / 2, 0, Math.PI / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + cell, y + cell, cell / 2, Math.PI, Math.PI * 1.5);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(x + cell, y, cell / 2, Math.PI / 2, Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + cell, cell / 2, Math.PI * 1.5, TAU);
        ctx.stroke();
      }
    }
  }
  grain(ctx, w, h, 0.05, rng);
  vignette(ctx, w, h, 0.22);
}

// ---- Mosaic: bold bauhaus-style shape grid ----
function drawMosaic(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const cols = ri(rng, 4, 7);
  const cell = w / cols;
  const rows = Math.ceil(h / cell);
  const bgPool = [0, 0, 1, 1, 2]; // weight toward the darker palette entries
  // corner data for quarter-disc shapes: [cx, cy, startAngle]
  const corners = (x, y) => [
    [x, y, 0],
    [x + cell, y, Math.PI / 2],
    [x + cell, y + cell, Math.PI],
    [x, y + cell, Math.PI * 1.5]
  ];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cell;
      const y = r * cell;
      const bi = pick(rng, bgPool);
      let si = ri(rng, 0, C.length - 1);
      if (si === bi) si = (si + 2) % C.length;
      ctx.fillStyle = css(C[bi]);
      ctx.fillRect(x - 0.5, y - 0.5, cell + 1, cell + 1);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cell, cell);
      ctx.clip();
      ctx.fillStyle = css(C[si]);
      ctx.strokeStyle = css(C[si]);
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const shape = rng();
      if (shape < 0.22) {
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.36, 0, TAU);
        ctx.fill();
      } else if (shape < 0.42) {
        const rot = ri(rng, 0, 3) * (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(cx, cy, cell / 2, rot, rot + Math.PI);
        ctx.closePath();
        ctx.fill();
      } else if (shape < 0.68) {
        const [qx, qy, a0] = pick(rng, corners(x, y));
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.arc(qx, qy, cell, a0, a0 + Math.PI / 2);
        ctx.closePath();
        ctx.fill();
      } else if (shape < 0.85) {
        const pts = [[x, y], [x + cell, y], [x + cell, y + cell], [x, y + cell]];
        const k = ri(rng, 0, 3);
        const p1 = pts[k], p2 = pts[(k + 1) % 4], p3 = pts[(k + 2) % 4];
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.lineTo(p3[0], p3[1]);
        ctx.closePath();
        ctx.fill();
      } else if (shape < 0.93) {
        ctx.lineWidth = cell * 0.13;
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.3, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  grain(ctx, w, h, 0.05, rng);
}

// ---- Topo: concentric noise-distorted contour rings ----
function drawTopo(ctx, w, h, rng, pal) {
  const C = pal.colors.map(rgb);
  const noise = makeNoise2D(rng);
  const fbm = makeFbm(noise, 3, 2, 0.5);
  ctx.fillStyle = css(shade(C[0], -0.4));
  ctx.fillRect(0, 0, w, h);

  const cx = rr(rng, 0.3, 0.7) * w;
  const cy = rr(rng, 0.3, 0.7) * h;
  const nR = ri(rng, 34, 64);
  const maxR = Math.hypot(w, h) * rr(rng, 0.55, 0.8);
  const ampF = rr(rng, 0.06, 0.16);
  const sc = rr(rng, 0.7, 1.7);
  const zs = rr(rng, 0.12, 0.4);
  const rot = rr(rng, 0, TAU);
  const ex = rr(rng, 0.85, 1.25);
  const accEvery = ri(rng, 6, 11);
  const steps = 240;

  for (let i = 0; i < nR; i++) {
    const t = (i + 1) / nR;
    const r = Math.pow(t, ex) * maxR;
    const acc = i % accEvery === accEvery - 1;
    const col = acc ? C[4] : sampleGrad([C[1], C[2], C[3], C[4]], t);
    ctx.strokeStyle = css(col, acc ? 0.9 : 0.62);
    ctx.lineWidth = acc ? 2.4 : 1.1;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const th = (s / steps) * TAU;
      const nx = Math.cos(th + rot) * sc;
      const ny = Math.sin(th + rot) * sc;
      const rad = r * (1 + fbm(nx + 7.7, ny + i * zs) * ampF * (0.35 + t));
      const X = cx + Math.cos(th) * rad;
      const Y = cy + Math.sin(th) * rad;
      if (s === 0) ctx.moveTo(X, Y);
      else ctx.lineTo(X, Y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  vignette(ctx, w, h, 0.35);
  grain(ctx, w, h, 0.05, rng);
}

export const GENERATORS = [
  { id: "silk", name: "Silk", draw: drawSilk },
  { id: "bloom", name: "Bloom", draw: drawBloom },
  { id: "highlands", name: "Highlands", draw: drawHighlands },
  { id: "aurora", name: "Aurora", draw: drawAurora },
  { id: "facets", name: "Facets", draw: drawFacets },
  { id: "nebula", name: "Nebula", draw: drawNebula },
  { id: "conduit", name: "Conduit", draw: drawConduit },
  { id: "mosaic", name: "Mosaic", draw: drawMosaic },
  { id: "topo", name: "Topo", draw: drawTopo }
];
