import { chromium } from 'playwright';
const dir = process.cwd();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://' + dir + '/index.html');
await page.waitForTimeout(1200);

// 1. длинный текст + без номинала + без срока
await page.click('#settings summary');
await page.fill('#fBody', '{имя}, дарим сертификат на любые услуги эстетической стоматологии SmileClinic: диагностика, гигиена, отбеливание, реставрация и лечение — всё, что нужно вашей улыбке в этом сезоне, включая консультацию ортодонта и план лечения');
await page.fill('#fName', 'Маргарита Исааковна');
await page.fill('#fNum', 'N100');
await page.fill('#fVal', '');
await page.fill('#fDate', '');
await page.waitForTimeout(300);
let [d1] = await Promise.all([page.waitForEvent('download'), page.click('#btnPdf')]);
await d1.saveAs(dir + '/case-long.pdf');

// 2. фирменный Gotham Pro как свой шрифт
await page.selectOption('#fFont', 'custom');
await page.setInputFiles('#fFontReg', '/Users/talisman/Library/Fonts/gothampro.ttf');
await page.setInputFiles('#fFontBold', '/Users/talisman/Library/Fonts/gothampro_bold.ttf');
await page.fill('#fBody', '{имя}, этот сертификат дает возможность\nвоспользоваться любыми услугами\nэстетической стоматологии\nSmileClinic');
await page.fill('#fName', 'Сергей');
await page.fill('#fVal', '5000');
await page.fill('#fDate', '01.12.2026');
await page.waitForTimeout(600);
let [d2] = await Promise.all([page.waitForEvent('download'), page.click('#btnPdf')]);
await d2.saveAs(dir + '/case-gotham.pdf');

console.log('ok:', d1.suggestedFilename(), '|', d2.suggestedFilename());
console.log('errors:', errors.length ? errors : 'нет');
await b.close();
