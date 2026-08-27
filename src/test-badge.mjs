/* Проверка вкладки бейджей: предпросмотр, PDF на страницу, лист A4, PNG, пакет.
   node src/test-badge.mjs [путь к index.html]  (нужен npm i playwright) */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import os from "os";

const TOOL = process.argv[2] || path.resolve("index.html");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "badge-test-"));
const log = (ok, m) => console.log((ok ? "✓ " : "✗ ") + m);
let bad = 0;
const check = (ok, m) => { log(ok, m); if (!ok) bad++; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("pageerror", e => check(false, "ошибка на странице: " + e.message));
await page.goto("file://" + TOOL);
await page.waitForTimeout(900);

/* --- переключение на бейджи --- */
await page.click("#docBadge");
await page.waitForTimeout(300);
check(await page.isVisible("#rootBadge"), "панель бейджей открылась");
check(!(await page.isVisible("#rootCert")), "панель сертификатов спрятана");
const size = await page.evaluate(() => { const c = document.getElementById("cv"); return [c.width, c.height]; });
check(size[0] === 2068 && size[1] === 1084, "холст стал 2068×1084 (получили " + size.join("×") + ")");

/* --- заполняем как на макете --- */
await page.fill("#bName", "Юлия Момот");
await page.fill("#bRole", "Медсестра ЦСО");
await page.waitForTimeout(400);
await page.locator("#cv").screenshot({ path: path.join(OUT, "preview.png") });
check(fs.existsSync(path.join(OUT, "preview.png")), "предпросмотр отрисован");

/* --- PDF на страницу --- */
/** размер страниц PDF — читаем тем же pdf-lib, что и в инструменте */
async function pageSizes(file) {
  const b64 = fs.readFileSync(file).toString("base64");
  return page.evaluate(async d => {
    const bytes = Uint8Array.from(atob(d), c => c.charCodeAt(0));
    const doc = await PDFLib.PDFDocument.load(bytes);
    return doc.getPages().map(p => { const s = p.getSize(); return [Math.round(s.width), Math.round(s.height)]; });
  }, b64);
}
async function grab(sel) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 25000 }), page.click(sel)]);
  const f = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(f);
  return f;
}
const pdf1 = await grab("#btnPdf");
check(/Бейдж Юлия Момот\.pdf$/.test(pdf1), "имя файла: " + path.basename(pdf1));
const sz1 = await pageSizes(pdf1);
check(sz1.length === 1 && sz1[0][0] === 1034 && sz1[0][1] === 542, "страница 1034×542 pt (получили " + JSON.stringify(sz1) + ")");
check(fs.statSync(pdf1).size > 5000, "PDF не пустой (" + Math.round(fs.statSync(pdf1).size / 1024) + " КБ)");

/* --- PNG --- */
const png = await grab("#btnPng");
check(/\.png$/.test(png) && fs.statSync(png).size > 5000, "PNG скачался (" + Math.round(fs.statSync(png).size / 1024) + " КБ)");

/* --- лист A4 --- */
await page.evaluate(() => document.getElementById("bSettings").open = true);
await page.selectOption("#bSheet", "a4");
await page.waitForTimeout(200);
check(await page.isVisible("#bSheetOpts"), "настройки листа появились");
const info = await page.textContent("#bSizeInfo");
check(/На листе \d+×\d+ = \d+ шт\./.test(info), "подсказка о вместимости: " + info.trim());
check((await page.textContent("#btnPdf")).includes("A4"), "кнопка переключилась на лист A4");
check(!(await page.isVisible("#bFont")), "выбора шрифта у бейджа нет — печатаем вшитым Gotham");
const sheet = await grab("#btnPdf");
const szS = await pageSizes(sheet);
check(szS.length === 1 && szS[0][0] === 595 && szS[0][1] === 842, "лист A4 595×842 pt, 1 страница (получили " + JSON.stringify(szS) + ")");

/* --- пакет --- */
await page.click("#bTabBatch");
await page.fill("#bBatch", "Юлия Момот; Медсестра ЦСО\nИван Петров; Врач-стоматолог\nАнна Смирнова; Администратор");
await page.waitForTimeout(300);
check((await page.textContent("#bBatchInfo")).includes("3"), "пакет посчитан: " + (await page.textContent("#bBatchInfo")).trim());
const batch = await grab("#btnPdf");
check(fs.statSync(batch).size > 5000, "пакетный лист скачался");
check((await pageSizes(batch)).length === 1, "три бейджа легли на один лист");

/* --- длинные значения не рвут макет --- */
await page.click("#bTabOne");
await page.fill("#bName", "Александра Константинопольская-Романовская");
await page.fill("#bRole", "Старшая медицинская сестра стерилизационного отделения");
await page.waitForTimeout(400);
const fits = await page.evaluate(() => {
  const c = document.getElementById("cv"), ctx = c.getContext("2d");
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let minX = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  return { minX, maxX, maxY, w: c.width };
});
check(fits.minX > 20 && fits.maxX < fits.w - 20, "длинный текст остался в полях (x " + fits.minX + "…" + fits.maxX + ")");
check(fits.maxY < 778, "текст не залез на золотую полосу (низ " + fits.maxY + " < 778)");
await page.locator("#cv").screenshot({ path: path.join(OUT, "preview-long.png") });

/* --- возврат к сертификатам --- */
await page.click("#docCert");
await page.waitForTimeout(300);
const size2 = await page.evaluate(() => { const c = document.getElementById("cv"); return [c.width, c.height]; });
check(size2[0] === 2160 && size2[1] === 3200, "холст вернулся к 2160×3200");
await page.fill("#fName", "Сергей");
await page.fill("#fNum", "N005");
await page.fill("#fVal", "5000");
await page.waitForTimeout(300);
const cert = await grab("#btnPdf");
check(/Сертификат N005 Сергей\.pdf$/.test(cert), "сертификат по-прежнему выпускается: " + path.basename(cert));
const szC = await pageSizes(cert);
check(szC[0][0] === 1080 && szC[0][1] === 1600, "сертификат 1080×1600 pt (получили " + JSON.stringify(szC) + ")");

console.log("\nфайлы: " + OUT);
console.log(bad ? `ПРОВАЛОВ: ${bad}` : "всё зелёное");
await browser.close();
process.exit(bad ? 1 : 0);
