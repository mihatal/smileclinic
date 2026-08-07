import { chromium } from 'playwright';
import fs from 'fs';

const dir = process.cwd();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto('file://' + dir + '/index.html');
await page.waitForTimeout(1500);

await page.fill('#fName', 'Сергей');
await page.fill('#fNum', 'N005');
await page.fill('#fVal', '5000');
await page.fill('#fDate', '01.12.2026');
await page.click('#settings summary');
await page.fill('#fH2', 'с 9:00 до 22:00');
await page.waitForTimeout(400);

await page.screenshot({ path: 'ui.png', fullPage: false });

const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btnPdf'),
]);
await dl.saveAs(dir + '/out.pdf');

// PNG
const [dl2] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btnPng'),
]);
await dl2.saveAs(dir + '/out.png');

// пакетный режим
await page.click('#tabBatch');
await page.fill('#fBatch', 'Анна; N010; 10000\nПётр; N011; 3000\n; N012; 5000');
const [dl3] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#btnPdf'),
]);
await dl3.saveAs(dir + '/out-batch.pdf');

console.log('downloads ok:', dl.suggestedFilename(), '|', dl2.suggestedFilename(), '|', dl3.suggestedFilename());
console.log('errors:', errors.length ? errors : 'нет');
await b.close();
