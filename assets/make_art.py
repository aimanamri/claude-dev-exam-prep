#!/usr/bin/env python3
"""Generates the pixel-art hero and divider for the README (assets/hero.gif, hero.png, divider.gif).

Everything is drawn on a tiny pixel grid and scaled up with nearest-neighbour, so it stays crisp.
Needs Pillow:  python3 -m venv .venv && .venv/bin/pip install pillow && .venv/bin/python assets/make_art.py
"""
import math
import os

from PIL import Image

OUT = os.path.dirname(os.path.abspath(__file__))

# palette (Claude orange on warm charcoal)
BG = (26, 25, 23)
BG2 = (35, 33, 31)
GRID = (42, 40, 37)
ORANGE = (217, 119, 87)
LIGHT = (243, 170, 138)
DEEP = (150, 78, 55)
CREAM = (244, 239, 230)
MUTED = (138, 132, 120)
SPARK = (255, 211, 130)

# 5x7 pixel font
FONT = {
    "A": "01110 10001 10001 11111 10001 10001 10001",
    "B": "11110 10001 10001 11110 10001 10001 11110",
    "C": "01111 10000 10000 10000 10000 10000 01111",
    "D": "11110 10001 10001 10001 10001 10001 11110",
    "E": "11111 10000 10000 11110 10000 10000 11111",
    "F": "11111 10000 10000 11110 10000 10000 10000",
    "G": "01111 10000 10000 10011 10001 10001 01111",
    "H": "10001 10001 10001 11111 10001 10001 10001",
    "I": "11111 00100 00100 00100 00100 00100 11111",
    "L": "10000 10000 10000 10000 10000 10000 11111",
    "M": "10001 11011 10101 10101 10001 10001 10001",
    "N": "10001 11001 10101 10011 10001 10001 10001",
    "O": "01110 10001 10001 10001 10001 10001 01110",
    "P": "11110 10001 10001 11110 10000 10000 10000",
    "R": "11110 10001 10001 11110 10100 10010 10001",
    "S": "01111 10000 10000 01110 00001 00001 11110",
    "T": "11111 00100 00100 00100 00100 00100 00100",
    "U": "10001 10001 10001 10001 10001 10001 01110",
    "V": "10001 10001 10001 10001 10001 01010 00100",
    "X": "10001 10001 01010 00100 01010 10001 10001",
    "-": "00000 00000 00000 11111 00000 00000 00000",
    "_": "00000 00000 00000 00000 00000 00000 11111",
    " ": "00000 00000 00000 00000 00000 00000 00000",
}


def text_width(s, scale=1):
    return (len(s) * 6 - 1) * scale


def draw_text(img, x, y, s, color, scale=1):
    px = img.load()
    for ch in s:
        rows = FONT[ch].split()
        for ry, row in enumerate(rows):
            for rx, bit in enumerate(row):
                if bit == "1":
                    for dy in range(scale):
                        for dx in range(scale):
                            X, Y = x + rx * scale + dx, y + ry * scale + dy
                            if 0 <= X < img.width and 0 <= Y < img.height:
                                px[X, Y] = color
        x += 6 * scale


def rect(img, x, y, w, h, color):
    px = img.load()
    for j in range(y, y + h):
        for i in range(x, x + w):
            if 0 <= i < img.width and 0 <= j < img.height:
                px[i, j] = color


def starburst(size, angle_deg, pulse):
    """Claude-style radial burst as a size x size RGBA sprite. Long and short rays alternate (6-fold symmetry)."""
    spr = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = spr.load()
    c = (size - 1) / 2
    r_max = size / 2 - 0.5
    for j in range(size):
        for i in range(size):
            dx, dy = i - c, j - c
            d = math.hypot(dx, dy)
            if d > r_max:
                continue
            a = (math.degrees(math.atan2(dy, dx)) - angle_deg) % 360
            k = a % 30
            off = min(k, 30 - k)  # degrees off the nearest ray (12 rays)
            long_ray = int(round((a - off) / 30)) % 2 == 0 if k < 15 else int(round((a + off) / 30)) % 2 == 0
            reach = r_max * (1.0 if long_ray else 0.66) * (0.9 + 0.1 * pulse)
            # rays narrow towards the tip
            half_width = max(0.7, 3.4 * (1 - d / max(reach, 1)) + 0.9)
            lateral = d * math.sin(math.radians(off))
            if d <= reach and lateral <= half_width or d < size * 0.12:
                t = d / r_max
                col = LIGHT if t < 0.28 else ORANGE if t < 0.8 else DEEP
                px[i, j] = col + (255,)
    return spr



CRAB = {
    "claws": ["##..........##", ".##........##."],
    "body": [".############.", ".##E##..##E##.", ".############.", "..##########.."],
    "legs": ["..#.#....#.#..", ".#..#....#..#."],
}


def draw_crab(img, x, y, frame):
    rows = [CRAB["claws"][frame], CRAB["claws"][frame]] + CRAB["body"] + [CRAB["legs"][frame]]
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == "#":
                rect(img, x + i, y + j, 1, 1, LIGHT if j in (2,) else ORANGE)
            elif ch == "E":
                rect(img, x + i, y + j, 1, 1, BG)


def sparkle(img, cx, cy, phase, t, n):
    """Small twinkling plus-sign."""
    v = (math.sin(2 * math.pi * (t / n + phase)) + 1) / 2
    if v < 0.25:
        return
    col = SPARK if v > 0.6 else MUTED
    rect(img, cx, cy, 1, 1, col)
    if v > 0.6:
        for ox, oy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rect(img, cx + ox, cy + oy, 1, 1, MUTED if v < 0.85 else col)


def hero_frame(t, n, w=320, h=80):
    img = Image.new("RGB", (w, h), BG)
    # dotted pixel grid
    for y in range(0, h, 8):
        for x in range(0, w, 8):
            rect(img, x, y, 1, 1, GRID)
    # floor strip (marches left)
    for x in range(0, w, 8):
        xx = (x - int(t * 8 / n)) % w
        rect(img, xx, h - 6, 4, 2, BG2)
        rect(img, xx + 4, h - 4, 4, 2, DEEP if (x // 8) % 5 == 0 else BG2)

    # starburst, slowly turning (60 degrees = one symmetric period) and pulsing
    pulse = (math.sin(2 * math.pi * t / n) + 1) / 2
    spr = starburst(51, 60 * t / n, pulse)
    img.paste(spr, (8, 12), spr)

    # DEV with a hard pixel shadow
    scale = 5
    tx, ty = 68, 12
    draw_text(img, tx + 1, ty + 2, "DEV", DEEP, scale)
    draw_text(img, tx, ty, "DEV", CREAM, scale)
    # blinking cursor
    if (t * 2 // n) % 2 == 0:
        cx = tx + text_width("DEV", scale) + 5
        rect(img, cx, ty + 35 - 5, 17, 5, ORANGE)

    # tagline
    draw_text(img, 68, 55, "CLAUDE CERTIFIED DEVELOPER - FOUNDATIONS", MUTED, 1)

    # CCDV-F badge, top right
    label = "CCDV-F"
    bw = text_width(label, 2) + 14
    bx, by = w - bw - 14, 14
    rect(img, bx, by, bw, 22, ORANGE)
    rect(img, bx, by, bw, 2, LIGHT)
    rect(img, bx, by + 20, bw, 2, DEEP)
    draw_text(img, bx + 7, by + 4, label, BG, 2)
    draw_text(img, bx, by + 27, "EXAM PREP", MUTED, 1)

    # Claude Code crab scuttling along the floor
    cx = int(-16 + (w + 32) * t / n)
    draw_crab(img, cx, h - 15, (t // 2) % 2)

    # twinkles
    for (sx, sy, ph) in ((62, 5, 0.0), (190, 6, 0.45), (214, 30, 0.3), (30, 6, 0.8)):
        sparkle(img, sx, sy, ph, t, n)
    return img


def divider_frame(t, n, w=320, h=9):
    img = Image.new("RGB", (w, h), BG)
    pitch = 16
    shift = int(t * pitch / n)
    for k in range(-1, w // pitch + 2):
        x = k * pitch - shift + 4
        lit = ((k + (t * 2) // n) % 3 == 0)
        col = ORANGE if lit else DEEP
        plus = [(1, 0), (0, 1), (1, 1), (2, 1), (1, 2)]
        cross = [(0, 0), (2, 0), (1, 1), (0, 2), (2, 2)]
        for dx, dy in (plus if (t // (n // 4)) % 2 == 0 else cross):
            rect(img, x + dx, h // 2 - 1 + dy - 1, 1, 1, col)
    return img


def save_gif(frames, path, scale, ms):
    big = [f.resize((f.width * scale, f.height * scale), Image.NEAREST) for f in frames]
    pal = big[0].quantize(colors=16, method=Image.Quantize.MEDIANCUT)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in big]
    q[0].save(path, save_all=True, append_images=q[1:], duration=ms, loop=0, optimize=True, disposal=1)


if __name__ == "__main__":
    N = 24
    hero = [hero_frame(t, N) for t in range(N)]
    save_gif(hero, os.path.join(OUT, "hero.gif"), 4, 90)
    still = hero[6].resize((1280, 320), Image.NEAREST)
    still.save(os.path.join(OUT, "hero.png"))
    div = [divider_frame(t, 16) for t in range(16)]
    save_gif(div, os.path.join(OUT, "divider.gif"), 4, 110)
    print("wrote hero.gif, hero.png, divider.gif")
