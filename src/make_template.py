#!/usr/bin/env python3
"""Готовит шаблон и фон предпросмотра из пустого макета сертификата.

Зачем: инструмент печатает текст поверх настоящего PDF-макета, закрашивая
редактируемую зону. Если в макете останется свой текст, он будет лежать под
заливкой невидимым, но копируемым (так в исходнике жило «с 9:00 до 21:00»).
Скрипт вырезает текст из этой зоны и рендерит фон для предпросмотра.

Запуск:  python3 make_template.py "путь/к/Сертификат пустой.pdf"
На выходе рядом со скриптом: template_clean.pdf и bg2x.png.
Нужен pymupdf и Pillow:  pip3 install --user pymupdf pillow
"""
import os, sys
import fitz
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ZONE = (508, 1440)          # редактируемая зона по вертикали, пункты страницы
COVER = (520, 1425)         # что закрашивает сам инструмент (см. L.cover в tool.tpl.html)
PAGE = (1080, 1600)


def main(src):
    doc = fitz.open(src)
    page = doc[0]
    if tuple(round(v) for v in page.rect[2:]) != PAGE:
        sys.exit(f"Ожидалась страница {PAGE[0]}×{PAGE[1]} pt, а тут {page.rect}. "
                 "Раскладка в tool.tpl.html завязана на этот размер — сверь координаты.")

    # 1. фон в зоне заливки обязан быть ровным, иначе прямоугольник будет виден
    pm = page.get_pixmap(dpi=72)
    px = Image.frombytes("RGB", (pm.width, pm.height), pm.samples).load()
    tone = {}
    for y in range(COVER[0], COVER[1], 3):
        for x in range(0, PAGE[0], 11):
            tone[px[x, y]] = tone.get(px[x, y], 0) + 1
    fon, доля = max(tone.items(), key=lambda kv: kv[1])
    print(f"фон зоны: rgb{fon}, занимает {доля/sum(tone.values())*100:.1f}% проб "
          f"(остальное — текст макета и разделитель)")

    # 2. вырезаем текст только из редактируемой зоны, картинки и линии не трогаем
    page.add_redact_annot(fitz.Rect(0, ZONE[0], PAGE[0], ZONE[1]))
    page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                          graphics=fitz.PDF_REDACT_LINE_ART_NONE,
                          text=fitz.PDF_REDACT_TEXT_REMOVE)
    out_pdf = os.path.join(HERE, "template_clean.pdf")
    doc.save(out_pdf, garbage=4, deflate=True)

    clean = fitz.open(out_pdf)[0]
    print("остался текст (должны быть только заголовок и адрес сайта):",
          repr(clean.get_text().replace("\n", " | ")))

    # 3. фон предпросмотра: та же страница в 2× с уже пустой серединой
    pm2 = clean.get_pixmap(dpi=144)
    img = Image.frombytes("RGB", (pm2.width, pm2.height), pm2.samples)
    ImageDraw.Draw(img).rectangle([0, COVER[0] * 2, pm2.width, COVER[1] * 2], fill=fon)
    out_png = os.path.join(HERE, "bg2x.png")
    img.save(out_png)

    print(f"готово: {os.path.basename(out_pdf)} ({os.path.getsize(out_pdf)//1024} КБ), "
          f"{os.path.basename(out_png)} ({os.path.getsize(out_png)//1024} КБ)")
    print("дальше: python3 build.py ../certificate/index.html")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
