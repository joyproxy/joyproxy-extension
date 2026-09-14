"""Generate extension PNG icons from store/joyproxy_icon.png (or logo.svg fallback)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "store" / "joyproxy_icon.png"
OUT = ROOT / "src" / "icons"
SIZES = (16, 32, 48, 128)


def content_bbox(im: Image.Image, alpha_min: int = 8) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] >= alpha_min:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx < minx:
        return 0, 0, w, h
    return minx, miny, maxx + 1, maxy + 1


def load_master() -> Image.Image:
    if not SRC.is_file():
        raise SystemExit(f"Missing source icon: {SRC}")
    im = Image.open(SRC).convert("RGBA")
    box = content_bbox(im)
    return im.crop(box)


def resize_icon(master: Image.Image, size: int) -> Image.Image:
    return master.resize((size, size), Image.Resampling.LANCZOS)


def to_gray(im: Image.Image) -> Image.Image:
    """Inactive toolbar icon: slate gradient background, white J."""
    w, h = im.size
    src = im.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    top = (100, 116, 139)
    bottom = (71, 85, 105)
    for y in range(h):
        t = y / max(h - 1, 1)
        bg = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            r, g, b, a = src[x, y]
            if a < 8:
                dst[x, y] = (0, 0, 0, 0)
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum > 210:
                dst[x, y] = (255, 255, 255, a)
            else:
                dst[x, y] = (*bg, a)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    master = load_master()
    for size in SIZES:
        color = resize_icon(master, size)
        gray = to_gray(color)
        color.save(OUT / f"icon{size}.png", optimize=True)
        gray.save(OUT / f"icon{size}-gray.png", optimize=True)
    print("wrote icons to", OUT)


if __name__ == "__main__":
    main()
