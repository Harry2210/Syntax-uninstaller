"""
Rasterises the Syntax Uninstaller brand mark into every icon size the desktop
app and the Windows shell need.

The design mirrors public/logo.svg exactly: a rounded gradient tile
(violet -> purple -> teal) with a single white "S" sweep and a small spark.

All geometry is expressed in the SVG's 512-unit coordinate space and scaled
exactly once per output size.

Usage:
    python scripts/generate_icons.py

Requires Pillow + numpy (both bundled with the DSH Python runtime).
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw

# Design tokens, in the SVG's 512x512 coordinate space.
DESIGN = 512.0
TILE_RADIUS = 116.0
S_STROKE = 56.0
SPARK_CENTER = (386.0, 128.0)
SPARK_RADIUS = 15.0

GRADIENT_START = (0x8B, 0x5C, 0xF6)
GRADIENT_MID = (0x7C, 0x5C, 0xFC)
GRADIENT_END = (0x22, 0xC7, 0xA9)

# The "S" sweep, as cubic segments in design units (matches the SVG path).
S_SEGMENTS = [
    ((334, 170), (334, 130), (294, 106), (250, 106)),
    ((250, 106), (200, 106), (166, 134), (166, 174)),
    ((166, 174), (166, 216), (204, 232), (254, 244)),
    ((254, 244), (304, 256), (348, 274), (348, 320)),
    ((348, 320), (348, 366), (310, 398), (256, 398)),
    ((256, 398), (208, 398), (172, 374), (172, 334)),
]


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def gradient_image(size: int) -> Image.Image:
    """Diagonal violet -> purple -> teal gradient."""
    y, x = np.mgrid[0:size, 0:size]
    t = np.clip((x + y) / (2.0 * (size - 1)), 0.0, 1.0)

    stops = np.array([0.0, 0.52, 1.0])
    colors = np.array([GRADIENT_START, GRADIENT_MID, GRADIENT_END], dtype=float)

    rgb = np.zeros((size, size, 3), dtype=float)
    for channel in range(3):
        rgb[:, :, channel] = np.interp(t, stops, colors[:, channel])

    return Image.fromarray(rgb.astype(np.uint8), mode="RGB")


def bezier(points, steps: int = 160):
    p0, p1, p2, p3 = points
    out = []
    for i in range(steps + 1):
        u = i / steps
        v = 1 - u
        out.append(
            (
                v**3 * p0[0] + 3 * v**2 * u * p1[0] + 3 * v * u**2 * p2[0] + u**3 * p3[0],
                v**3 * p0[1] + 3 * v**2 * u * p1[1] + 3 * v * u**2 * p2[1] + u**3 * p3[1],
            )
        )
    return out


def s_path(k: float, steps: int = 160):
    points = []
    for segment in S_SEGMENTS:
        sampled = bezier([(px * k, py * k) for px, py in segment], steps=steps)
        if points:
            sampled = sampled[1:]
        points.extend(sampled)
    return points


def render(size: int) -> Image.Image:
    k = size / DESIGN

    # Tile with a soft top sheen
    base = gradient_image(size).convert("RGBA")

    sheen = Image.new("L", (1, size), 0)
    for y in range(size):
        strength = 0.32 * max(0.0, 1 - y / (size * 0.62))
        sheen.putpixel((0, y), int(strength * 255))
    sheen = sheen.resize((size, size))

    white = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    base = Image.composite(white, base, sheen)

    tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile.paste(base, (0, 0), rounded_mask(size, int(TILE_RADIUS * k)))

    draw = ImageDraw.Draw(tile)

    # "S" sweep, painted with a round brush along the curve. Drawing a dense
    # row of overlapping ellipses gives a clean, smooth stroke (PIL's aliased
    # polyline left visible seams and grain inside the glyph).
    radius = S_STROKE * k / 2.0
    for (x, y) in s_path(k, steps=260):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 255, 255, 255))

    # Clean-up spark
    cx, cy = SPARK_CENTER[0] * k, SPARK_CENTER[1] * k
    sr = SPARK_RADIUS * k
    draw.ellipse((cx - sr, cy - sr, cx + sr, cy + sr), fill=(255, 255, 255, 235))

    return tile


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons_dir = os.path.join(root, "src-tauri", "icons")
    os.makedirs(icons_dir, exist_ok=True)

    master = render(2048)

    outputs = {
        "32x32.png": 32,
        "64x64.png": 64,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }

    for name, px in outputs.items():
        master.resize((px, px), Image.LANCZOS).save(os.path.join(icons_dir, name), optimize=True)

    master.save(
        os.path.join(icons_dir, "icon.ico"),
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    master.resize((256, 256), Image.LANCZOS).save(
        os.path.join(root, "public", "logo.png"), optimize=True
    )

    print(f"Wrote {len(outputs) + 2} icon files to {icons_dir}")


if __name__ == "__main__":
    main()
