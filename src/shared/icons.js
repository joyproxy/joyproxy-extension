const cache = new Map();
let lastKey = "";

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function paint(size, variant) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, size, size);
  if (variant === "gray") {
    g.addColorStop(0, "#64748b");
    g.addColorStop(1, "#334155");
  } else {
    g.addColorStop(0, "#667eea");
    g.addColorStop(1, "#764ba2");
  }
  roundRect(ctx, 1, 1, size - 2, size - 2, size * 0.2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.round(size * 0.58)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("J", size / 2, size / 2 + size * 0.04);
  return ctx.getImageData(0, 0, size, size);
}

function imageDataFor(variant) {
  const key = variant;
  if (cache.has(key)) return cache.get(key);
  const imageData = {
    16: paint(16, variant),
    32: paint(32, variant),
    48: paint(48, variant),
  };
  cache.set(key, imageData);
  return imageData;
}

async function silent(fn) {
  try {
    await fn();
  } catch {
    /* ignore */
  }
  void chrome.runtime.lastError;
}

export async function setActionAppearance({ variant, badge, color, title }) {
  const key = `${variant}|${badge || ""}|${title || ""}`;
  if (key === lastKey) return;
  lastKey = key;
  await silent(() => chrome.action.setIcon({ imageData: imageDataFor(variant) }));
  await silent(() => chrome.action.setBadgeText({ text: badge || "" }));
  if (color) await silent(() => chrome.action.setBadgeBackgroundColor({ color }));
  if (title) await silent(() => chrome.action.setTitle({ title }));
}
