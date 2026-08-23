"""Generate toolbar PNGs from a rounded-rect J mark."""
from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src" / "icons"


def lerp(a, b, t):
    return a + (b - a) * t


def png(width: int, height: int, rgba_rows) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = b"".join(b"\x00" + bytes(row) for row in rgba_rows)
    return b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )


def rounded_rect_mask(size: int, radius: float) -> list[list[float]]:
    mask = [[0.0] * size for _ in range(size)]
    r = radius
    for y in range(size):
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            dx = min(px, size - px)
            dy = min(py, size - py)
            if dx >= r and dy >= r:
                mask[y][x] = 1.0
            elif dx >= r or dy >= r:
                mask[y][x] = 1.0
            else:
                # distance to inner corner
                cx = r if px < r else size - r
                cy = r if py < r else size - r
                d = math.hypot(px - cx, py - cy)
                edge = r - d
                mask[y][x] = max(0.0, min(1.0, 0.5 + edge))
    return mask


def glyph_j(size: int) -> list[list[float]]:
    """Simple geometric J, 0–1 coverage."""
    cov = [[0.0] * size for _ in range(size)]
    # Scale from a 100x100 design box
    def fill_rect(x0, y0, x1, y1, w=1.0):
        for y in range(size):
            for x in range(size):
                u = (x + 0.5) / size * 100
                v = (y + 0.5) / size * 100
                if x0 <= u <= x1 and y0 <= v <= y1:
                    cov[y][x] = max(cov[y][x], w)

    def fill_arc():
        # bottom bowl of J
        cx, cy, r_out, r_in = 46, 62, 22, 11
        for y in range(size):
            for x in range(size):
                u = (x + 0.5) / size * 100
                v = (y + 0.5) / size * 100
                if v < cy:
                    continue
                d = math.hypot(u - cx, v - cy)
                if r_in <= d <= r_out and u >= 28:
                    cov[y][x] = max(cov[y][x], 1.0)

    fill_rect(54, 22, 68, 64)
    fill_arc()
    return cov


def render(size: int, colors: tuple[tuple[int, int, int], tuple[int, int, int]], saturated: bool) -> bytes:
    c0, c1 = colors
    radius = size * 0.16
    pad = size * 0.05
    inner = size - pad * 2
    mask = rounded_rect_mask(size, radius)
    glyph = glyph_j(size)
    rows = []
    for y in range(size):
        row = []
        t = y / max(size - 1, 1)
        cr = int(lerp(c0[0], c1[0], t))
        cg = int(lerp(c0[1], c1[1], t))
        cb = int(lerp(c0[2], c1[2], t))
        if not saturated:
            gray = int(0.35 * cr + 0.45 * cg + 0.2 * cb)
            cr = cg = cb = gray
        for x in range(size):
            a = mask[y][x]
            # slight inner inset so it matches the SVG 5px padding
            u = (x + 0.5) / size
            v = (y + 0.5) / size
            if u < 0.05 or u > 0.95 or v < 0.05 or v > 0.95:
                a *= max(0.0, min(1.0, (min(u, 1 - u, v, 1 - v) - 0.02) / 0.03))
            gj = glyph[y][x]
            r = int(cr * (1 - gj) + 255 * gj)
            g = int(cg * (1 - gj) + 255 * gj)
            b = int(cb * (1 - gj) + 255 * gj)
            row.extend([r, g, b, int(a * 255)])
        rows.append(row)
    return png(size, size, rows)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    color = ((102, 126, 234), (118, 75, 162))
    gray = ((100, 116, 139), (71, 85, 105))
    for size in (16, 32, 48, 128):
        (ROOT / f"icon{size}.png").write_bytes(render(size, color, True))
        (ROOT / f"icon{size}-gray.png").write_bytes(render(size, gray, False))
    print("wrote icons to", ROOT)


if __name__ == "__main__":
    main()
