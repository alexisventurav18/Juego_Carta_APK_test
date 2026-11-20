#!/usr/bin/env python3
"""Genera el icono y el splash de Cartas Dominicanas.

Diseño: fondo de madera oscura con viñeta dorada, abanico de tres cartas
(K♥, A♠ al frente, Q♦) con anillo dorado y una cinta tricolor dominicana
bajo las cartas. Todo se dibuja con PIL, sin dependencias de red, para que
el resultado sea reproducible: `python3 scripts/generateIcon.py`.

Salidas:
  resources/icon.png            (1024, icono completo)
  resources/icon-foreground.png (1024, solo el emblema, fondo transparente)
  resources/icon-background.png (1024, solo el fondo de madera)
  resources/splash.png / splash-dark.png (2732, fondo + emblema + título)
  public/icon-512.png           (512, para el manifiesto PWA)
Después, `npm run android:assets` regenera los mipmaps de Android.
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "resources")
PUB = os.path.join(ROOT, "public")

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

WOOD_TOP = (74, 42, 18)
WOOD_BOTTOM = (24, 12, 5)
GOLD = (252, 211, 77)
GOLD_DARK = (217, 119, 6)
CARD_WHITE = (255, 253, 246)
CARD_EDGE = (243, 234, 210)
INK = (15, 23, 42)
RED = (220, 38, 38)
BLUE = (0, 45, 98)
FLAG_RED = (206, 17, 38)


def lerp(a: int, b: int, t: float) -> int:
    return round(a + (b - a) * t)


def wood_background(size: int) -> Image.Image:
    """Degradado vertical de madera oscura con viñeta cálida en el centro."""
    img = Image.new("RGB", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        draw.line([(0, y), (size, y)], fill=tuple(lerp(WOOD_TOP[i], WOOD_BOTTOM[i], t) for i in range(3)))
    glow = Image.new("RGB", (size, size), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([size * 0.08, -size * 0.25, size * 0.92, size * 0.75], fill=(122, 74, 34))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.12))
    img = Image.blend(img, Image.composite(glow, img, glow.convert("L").point(lambda v: v // 3)), 0.55)
    return img.convert("RGBA")


def draw_card(rank: str, suit: str, color: tuple[int, int, int], w: int, h: int) -> Image.Image:
    """Una carta blanca con rango en las esquinas y palo grande en el centro."""
    card = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle([4, 4, w * 2 - 4, h * 2 - 4], radius=28, fill=CARD_WHITE + (255,), outline=(120, 90, 40, 255), width=3)
    d.rounded_rectangle([14, 14, w * 2 - 14, h * 2 - 14], radius=22, outline=CARD_EDGE + (255,), width=2)
    rank_font = ImageFont.truetype(FONT_BOLD, int(w * 0.42))
    suit_font = ImageFont.truetype(FONT_BOLD, int(w * 0.95))
    d.text((int(w * 0.14), int(w * 0.06)), rank, font=rank_font, fill=color + (255,))
    d.text((int(w * 0.14), int(w * 0.52)), suit, font=ImageFont.truetype(FONT_BOLD, int(w * 0.34)), fill=color + (255,))
    # Palo central.
    bbox = d.textbbox((0, 0), suit, font=suit_font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((w * 2 - tw) / 2 - bbox[0], (h * 2 - th) / 2 - bbox[1] - h * 0.08), suit, font=suit_font, fill=color + (255,))
    return card.resize((w, h), Image.LANCZOS)


def paste_rotated(base: Image.Image, img: Image.Image, cx: int, cy: int, angle: float) -> None:
    """Pega una imagen girada, centrada en (cx, cy), con su silueta de sombra."""
    layer = Image.new("RGBA", (img.size[0] + 60, img.size[1] + 60), (0, 0, 0, 0))
    silhouette = Image.new("RGBA", img.size, (0, 0, 0, 0))
    silhouette.paste((0, 0, 0, 120), (0, 0), img.split()[3])
    silhouette = silhouette.filter(ImageFilter.GaussianBlur(8))
    layer.alpha_composite(silhouette, (30 + 8, 30 + 14))
    layer.alpha_composite(img, (30, 30))
    rotated = layer.rotate(angle, expand=True, resample=Image.BICUBIC)
    base.alpha_composite(rotated, (cx - rotated.size[0] // 2, cy - rotated.size[1] // 2))


def tricolor_ribbon(draw: ImageDraw.ImageDraw, cx: int, y: int, w: int, h: int) -> None:
    """Cinta azul-blanca-roja (bandera dominicana) bajo las cartas."""
    third = w // 3
    for i, color in enumerate((BLUE, (255, 255, 255), FLAG_RED)):
        draw.rounded_rectangle([cx - w // 2 + i * third, y, cx - w // 2 + (i + 1) * third, y + h],
                               radius=6, fill=color + (255,))
    draw.rounded_rectangle([cx - w // 2, y, cx + w // 2, y + h], radius=6, outline=GOLD + (255,), width=4)


def emblem(size: int) -> Image.Image:
    """El emblema (anillo dorado + abanico de cartas + cinta) sobre transparente."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size // 2
    ring_r = int(size * 0.335)
    d.ellipse([c - ring_r, c - ring_r - size * 0.01, c + ring_r, c + ring_r - size * 0.01],
              outline=GOLD + (255,), width=max(6, size // 110))
    d.ellipse([c - ring_r - 14, c - ring_r - 15, c + ring_r + 14, c + ring_r + 13],
              outline=GOLD + (110,), width=max(3, size // 220))
    cy = int(size * 0.50)
    paste_rotated(img, draw_card("K", "♥", RED, int(size * 0.26), int(size * 0.37)), c - int(size * 0.155), cy + int(size * 0.02), 20)
    paste_rotated(img, draw_card("Q", "♦", RED, int(size * 0.26), int(size * 0.37)), c + int(size * 0.155), cy + int(size * 0.02), -20)
    paste_rotated(img, draw_card("A", "♠", INK, int(size * 0.30), int(size * 0.43)), c, cy - int(size * 0.01), 0)
    d = ImageDraw.Draw(img)
    tricolor_ribbon(d, c, int(size * 0.76), int(size * 0.30), max(12, size // 64))
    return img


def main() -> None:
    os.makedirs(RES, exist_ok=True)
    os.makedirs(PUB, exist_ok=True)

    bg = wood_background(1024)
    fg = emblem(1024)
    icon = bg.copy()
    icon.alpha_composite(fg)
    bg.save(os.path.join(RES, "icon-background.png"))
    fg.save(os.path.join(RES, "icon-foreground.png"))
    icon.save(os.path.join(RES, "icon.png"))
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(PUB, "icon-512.png"))

    # Splash: mismo fondo y emblema, más grandes, con el título debajo.
    splash_bg = wood_background(2732)
    splash = splash_bg.copy()
    big = emblem(2732).resize((1900, 1900), Image.LANCZOS)
    splash.alpha_composite(big, ((2732 - 1900) // 2, 300))
    d = ImageDraw.Draw(splash)
    title_font = ImageFont.truetype(FONT_SERIF_BOLD, 150)
    title = "CARTAS DOMINICANAS"
    bbox = d.textbbox((0, 0), title, font=title_font)
    tw = bbox[2] - bbox[0]
    d.text(((2732 - tw) / 2 - bbox[0], 2250), title, font=title_font, fill=(255, 247, 230, 255))
    sub_font = ImageFont.truetype(FONT_BOLD, 62)
    sub = "Casino  •  Tres y Dos  •  El Cagao  •  El Robaíto"
    bbox = d.textbbox((0, 0), sub, font=sub_font)
    tw = bbox[2] - bbox[0]
    d.text(((2732 - tw) / 2 - bbox[0], 2440), sub, font=sub_font, fill=GOLD + (255,))
    splash.save(os.path.join(RES, "splash.png"))
    splash.save(os.path.join(RES, "splash-dark.png"))
    print("Icono y splash generados en resources/ y public/icon-512.png")


if __name__ == "__main__":
    main()
