import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/taiwan-trip.json');

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=swiftshader', '--no-sandbox'],
  });
  const page = await browser.newContext({ viewport: { width: 1280, height: 720 } }).then(c => c.newPage());

  // Capture console
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[visibility]') || text.includes('[routeDraw]') || text.includes('segment')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('Loading editor...');
  await page.goto('http://localhost:3000/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Importing fixture...');
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(FIXTURE);
  await page.waitForTimeout(10000);

  // Check how many segments exist and their layer visibility
  console.log('Checking layers before play...');
  const beforePlay = await page.evaluate(() => {
    const map = document.querySelector('.mapboxgl-canvas')?.closest('.mapboxgl-map');
    if (!map || !map.__mapboxgl) return 'no map';
    // Try to access map instance through mapbox internals
    return 'map found but cannot access instance directly';
  });
  console.log('Before play:', beforePlay);

  // Click play
  console.log('Clicking play...');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.querySelector('.lucide-play')) { b.click(); return 'clicked'; }
    }
    return 'not found';
  });

  // Wait and collect logs
  await page.waitForTimeout(5000);
  console.log('\n--- All console logs after 5s of playback ---');
  for (const log of logs) {
    if (log.includes('[visibility]') || log.includes('[routeDraw]') || log.includes('Error')) {
      console.log(log);
    }
  }

  // Take screenshot during playback
  await page.screenshot({ path: '/tmp/tr-debug-playing.png' });
  console.log('Screenshot saved to /tmp/tr-debug-playing.png');

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
