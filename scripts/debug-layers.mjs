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

  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  await page.goto('http://localhost:3000/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(FIXTURE);
  await page.waitForTimeout(10000);

  // Click play
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) {
      if (b.querySelector('.lucide-play')) { b.click(); break; }
    }
  });
  await page.waitForTimeout(5000);

  // Dump all relevant console logs
  console.log('=== Console logs ===');
  for (const l of logs) {
    if (l.includes('[visibility]') || l.includes('[routeDraw]') || l.includes('segment')) {
      console.log(l);
    }
  }

  // Check Zustand store state
  const storeState = await page.evaluate(() => {
    // Access Zustand stores through window if exposed
    // Let's try reading React fiber
    const root = document.getElementById('__next');
    if (!root) return 'no root';
    // Can't easily access zustand from outside, check console logs instead
    return 'check logs';
  });
  console.log('Store check:', storeState);

  console.log('\n=== ALL logs containing segment/visibility ===');
  const filtered = logs.filter(l => 
    l.includes('visibility') || l.includes('routeDraw') || l.includes('segment')
  );
  console.log(`Found ${filtered.length} relevant logs out of ${logs.length} total`);
  if (filtered.length === 0) {
    console.log('No relevant logs found. Dumping last 20 logs:');
    logs.slice(-20).forEach(l => console.log('  ', l));
  }

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
