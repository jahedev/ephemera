// Shared finishing touches: vignette, film grain, starfields.

export function vignette(ctx, w, h, strength = 0.3) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.hypot(w, h) * 0.58
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function grain(ctx, w, h, amount = 0.05) {
  const size = 140;
  const t = document.createElement("canvas");
  t.width = t.height = size;
  const tc = t.getContext("2d");
  const id = tc.createImageData(size, size);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  tc.putImageData(id, 0, 0);
  ctx.save();
  ctx.globalAlpha = amount;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(t, "repeat");
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function drawStars(ctx, w, h, rng, count) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const y = rng() * h;
    const r = 0.35 + rng() * 1.1;
    const a = 0.25 + rng() * 0.65;
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (rng() < 0.04) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
      g.addColorStop(0, `rgba(255,255,255,${(a * 0.5).toFixed(3)})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    }
  }
}
