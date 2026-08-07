import { chromium } from 'playwright';
const dir = process.cwd();
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const ok = [], bad = [];
const check = (cond, what) => (cond ? ok : bad).push(what);

await page.goto('file://' + dir + '/index.html');
await page.waitForTimeout(1200);

// --- клик по подписи ставит фокус в поле ---
await page.evaluate(()=>document.getElementById('settings').open=true);
for (const [lbl, id] of [['Имя получателя','fName'],['Номер','fNum'],['Номинал','fVal'],
  ['Срок действия','fDate'],['Текст сертификата','fBody'],['Телефон','fPhone']]) {
  await page.click(`label:text-is("${lbl}")`);
  const focused = await page.evaluate(() => document.activeElement.id);
  check(focused === id, `клик по подписи «${lbl}» → фокус в ${id} (получили ${focused})`);
}

// --- автофокус ---
await page.reload(); await page.waitForTimeout(1200);
check(await page.evaluate(() => document.activeElement.id) === 'fName', 'автофокус на «Имя»');

// --- быстрые кнопки ---
await page.click('button[data-val="10000"]');
check(await page.inputValue('#fVal') === '10000', 'кнопка номинала подставляет значение');
check(await page.locator('button[data-val="10000"]').evaluate(e => e.classList.contains('on')), 'активный номинал подсвечен');
await page.click('button[data-add="6"]');
const dt = await page.inputValue('#fDate');
check(/^\d{2}\.\d{2}\.\d{4}$/.test(dt), 'кнопка +6 мес даёт дату ' + dt);
await page.click('button[data-add="0"]');
check(await page.inputValue('#fDate') === '', 'кнопка «Убрать строку» чистит дату');
await page.fill('#fNum', 'N009');
await page.click('#btnNext');
check(await page.inputValue('#fNum') === 'N010', 'следующий номер N009 → ' + await page.inputValue('#fNum'));

// --- очень длинное слово без пробелов не вылезает за поля ---
await page.evaluate(()=>document.getElementById('settings').open=true);
await page.fill('#fBody', 'Сертификатнаэстетическуюстоматологиюсподарочнымоформлениемдлялюбимогочеловека');
await page.waitForTimeout(400);
const overflow = await page.evaluate(() => {
  const c = document.getElementById('cv'), x = c.getContext('2d');
  const d = x.getImageData(0, 1040, c.width, 720).data;   // зона текста
  let left = 1e9, right = -1;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 120) { const px = (i / 4) % c.width; if (px < left) left = px; if (px > right) right = px; }
  }
  return { left: left / 2, right: right / 2 };            // в пунктах страницы
});
check(overflow.left > 60 && overflow.right < 1020, `длинное слово в границах (${Math.round(overflow.left)}…${Math.round(overflow.right)} pt)`);

// --- пакет: табы как разделитель + строка-заголовок ---
await page.click('#tabBatch');
await page.fill('#fBatch', 'Имя\tНомер\tНоминал\nАнна\tN020\t10000\nПётр\tN021\t3000');
await page.waitForTimeout(300);
const info = await page.textContent('#batchInfo');
check(/2 страницы/.test(info), 'счётчик пакета: ' + info);
check(await page.locator('#btnPng').evaluate(e => e.classList.contains('hidden')), 'PNG скрыт в пакетном режиме');
const [d3] = await Promise.all([page.waitForEvent('download'), page.click('#btnPdf')]);
await d3.saveAs(dir + '/case-tabs.pdf');

// --- возврат на одиночную вкладку ---
await page.click('#tabOne');
check(!(await page.locator('#btnPng').evaluate(e => e.classList.contains('hidden'))), 'PNG вернулся на одиночной вкладке');

// --- сохранение настроек между перезагрузками ---
await page.evaluate(()=>document.getElementById('settings').open=true);
await page.fill('#fPhone', '+7 (812) 000 00 00');
await page.waitForTimeout(200);
await page.reload(); await page.waitForTimeout(1000);
check(await page.inputValue('#fPhone') === '+7 (812) 000 00 00', 'подвал пережил перезагрузку');
check(await page.inputValue('#fName') === '', 'имя не сохраняется (правильно)');

// --- узкий экран ---
await page.setViewportSize({ width: 700, height: 900 });
await page.waitForTimeout(300);
const cut = await page.evaluate(() => {
  const a = document.querySelector('.actions').getBoundingClientRect();
  return a.width <= window.innerWidth + 1 && a.left >= -1;
});
check(cut, 'кнопки не уезжают за экран на 700px');
await page.screenshot({ path: 'ui-mobile.png', fullPage: false });
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
await page.screenshot({ path: 'ui2.png' });

console.log('OK:'); ok.forEach(s => console.log('  + ' + s));
console.log(bad.length ? 'ПРОБЛЕМЫ:' : 'проблем нет'); bad.forEach(s => console.log('  ! ' + s));
console.log('ошибки страницы:', errors.length ? errors : 'нет');
await b.close();
