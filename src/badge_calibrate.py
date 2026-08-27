#!/usr/bin/env python3
"""Сверяет бейдж, выданный инструментом, с эталонным макетом — построчно.

Тот же приём, что и в calibrate.py для сертификата: у каждой строки меряется
реальная «коробка чернил». Δширины — про кегль и трекинг, Δверха — про базовую
линию, Δцентра — про горизонтальное центрирование. Норма: до ±3 pt по ширине,
±0,6 pt по вертикали, ±2,5 pt по центру (пара пунктов по центру набегает из-за
разного кернинга у canvas и pdf-lib — это не ошибка раскладки).

Запуск:  python3 badge_calibrate.py badge_reference.pdf выданный.pdf
Эталон — src/badge_reference.pdf (Юлия Момот / Медсестра ЦСО). Тот же набор надо
ввести в инструмент, иначе сравнивать нечего.

Макет свёрстан Gotham Pro Medium, тот же шрифт вшит в инструмент (src/G-Med.otf),
поэтому выданный PDF должен совпадать с эталоном практически пиксель в пиксель.

Если строка поехала: правь соответствующее поле в объекте L_BADGE в
src/tool.tpl.html (колонка «константа»), пересобирай build.py и гоняй заново.
Нужен pymupdf и Pillow.
"""
import sys
import fitz
from PIL import Image

S = 4  # во сколько раз рендерим для замера

# полоса поиска по вертикали → какая константа за неё отвечает
LINES = [
    ("имя",       (220, 300), "L_BADGE.name (кегль 51,5, трекинг 0,4, база 282)"),
    ("должность", (305, 375), "L_BADGE.role (кегль 29,5, трекинг 0,25, база 341)"),
]
CX = 517.0


def boxes(path):
    page = fitz.open(path)[0]
    pm = page.get_pixmap(dpi=72 * S)
    px = Image.frombytes("RGB", (pm.width, pm.height), pm.samples).load()
    out = {}
    for name, (y0, y1), _ in LINES:
        xmin, xmax, ymin, ymax = 10**9, -1, 10**9, -1
        for y in range(y0 * S, min(y1 * S, pm.height)):
            for x in range(pm.width):
                if sum(px[x, y]) > 500:            # белый текст на тёмном фоне
                    xmin = min(xmin, x); xmax = max(xmax, x)
                    ymin = min(ymin, y); ymax = max(ymax, y)
        out[name] = None if xmax < 0 else (xmin / S, xmax / S, ymin / S, ymax / S)
    return out


def main(ref, new):
    A, B = boxes(ref), boxes(new)
    print(f"{'строка':11s} {'Δширины':>9s} {'Δверха':>8s} {'Δцентра':>9s}   константа")
    плохо = 0
    for name, _, конст in LINES:
        a, b = A[name], B[name]
        if not a or not b:
            print(f"{name:11s} {'—':>9s} {'—':>8s} {'—':>9s}   "
                  f"{'нет в эталоне' if not a else 'нет в выданном'}")
            плохо += 1
            continue
        dw = (b[1] - b[0]) - (a[1] - a[0])
        dy = b[2] - a[2]
        dc = (b[0] + b[1]) / 2 - CX
        флаг = "" if abs(dw) <= 3 and abs(dy) <= 0.6 and abs(dc) <= 2.5 else "  ← ушло"
        плохо += bool(флаг)
        print(f"{name:11s} {dw:+9.2f} {dy:+8.2f} {dc:+9.2f}   {конст}{флаг}")
    print("\nвсё в допуске" if not плохо else f"\nстрок за допуском: {плохо}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
