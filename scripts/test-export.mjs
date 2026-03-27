import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/taiwan-trip.json');

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--enable-webgl2',
      '--use-gl=swiftshader',
      '--enable-gpu-rasterization',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
  });

  // Navigate to editor
  console.log('Navigating to editor...');
  await page.goto('http://localhost:3000/editor', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Taking initial screenshot...');
  await page.screenshot({ path: '/tmp/trace-recap-01-initial.png' });

  // Import fixture - set input files directly on the hidden input
  console.log('Importing fixture...');
  const fileInput = page.locator('input[type="file"][accept=".json"]');
  await fileInput.setInputFiles(FIXTURE);

  // Wait for geometry to generate (API calls for each segment)
  console.log('Waiting for route geometry...');
  await page.waitForTimeout(12000);
  
  console.log('Taking route screenshot...');
  await page.screenshot({ path: '/tmp/trace-recap-02-route.png' });

  // Click play button
  console.log('Starting playback...');
  // Find the play button by its SVG child
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.querySelector('.lucide-play')) {
        btn.click();
        return;
      }
    }
  });
  
  // Take screenshots during animation
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/trace-recap-03-playing.png' });
  
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/trace-recap-04-mid.png' });

  // Wait for animation to end
  await page.waitForTimeout(25000);
  await page.screenshot({ path: '/tmp/trace-recap-05-end.png' });
  
  console.log('All screenshots saved to /tmp/trace-recap-*.png');
  
  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
