import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../home/kaike/.openclaw/workspace/trace-recap/fixtures/taiwan-trip.json');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=swiftshader', '--no-sandbox'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();

  const logs = [];
  page.on('console', msg => {
    const t = msg.text();
    logs.push(t);
    if (t.includes('[visibility]')) console.log('>>> ' + t);
  });

  console.log('1. Navigate...');
  await page.goto('http://localhost:3004/editor', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(3000);

  console.log('2. Import fixture...');
  await page.locator('input[type="file"][accept=".json"]').first().setInputFiles(
    '/home/kaike/.openclaw/workspace/trace-recap/fixtures/taiwan-trip.json'
  );
  await page.waitForTimeout(12000);

  console.log('3. Check idle visibility logs...');
  const idleLogs = logs.filter(l => l.includes('[visibility]'));
  console.log(`  Found ${idleLogs.length} visibility logs in idle state`);
  idleLogs.slice(-3).forEach(l => console.log('  ', l));

  console.log('4. Click play...');
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.querySelector('.lucide-play')) { b.click(); break; }
    }
  });

  await page.waitForTimeout(3000);

  console.log('5. Check playing visibility logs...');
  const playLogs = logs.filter(l => l.includes('[visibility]'));
  console.log(`  Total visibility logs: ${playLogs.length}`);
  // Show last 10
  playLogs.slice(-10).forEach(l => console.log('  ', l));

  // Check for HIDE logs
  const hideLogs = logs.filter(l => l.includes('HIDE future'));
  console.log(`\n6. HIDE future logs: ${hideLogs.length}`);
  hideLogs.slice(0, 5).forEach(l => console.log('  ', l));

  // Screenshot
  await page.screenshot({ path: '/tmp/debug-vis-playing.png' });
  console.log('\nScreenshot saved');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
