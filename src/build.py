#!/usr/bin/env python3
"""Собирает однофайловый HTML-инструмент: вшивает pdf-lib, fontkit, шрифты, шаблон PDF и фон."""
import base64, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
def rd(p, mode="rb"):
    with open(os.path.join(HERE, p), mode) as f: return f.read()
def b64(p): return base64.b64encode(rd(p)).decode()

tpl = open(os.path.join(HERE, "tool.tpl.html"), encoding="utf-8").read()

repl = {
    "{{PDFLIB}}":        open(os.path.join(HERE, "pdf-lib.min.js"), encoding="utf-8").read(),
    "{{FONTKIT}}":       open(os.path.join(HERE, "fontkit.umd.min.js"), encoding="utf-8").read(),
    "{{TPL_PDF_B64}}":   b64("template_clean.pdf"),
    "{{BG_B64}}":        b64("bg2x.png"),
    "{{FONT_REG_B64}}":  b64("M-Reg.ttf"),
    "{{FONT_BOLD_B64}}": b64("M-Bold.ttf"),
}
out = tpl
for k, v in repl.items():
    out = out.replace(k, v)

dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "certificate", "index.html")
with open(dest, "w", encoding="utf-8") as f: f.write(out)
print("built:", dest, round(len(out.encode())/1024), "KB")
