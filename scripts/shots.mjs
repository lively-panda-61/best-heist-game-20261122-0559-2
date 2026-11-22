// Screenshot run: renders every scene in shots.json in a 1280x720 browser
// and writes it to screenshots/ as a JPEG that fits the gate caps (at most
// 256 KiB, long side at most 1280, short side at least 480). Run: node scripts/shots.mjs
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launchBrowser, PORT, startServer } from './browser.mjs';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${PORT}`;
const MAX_BYTES = 262144;

async function main() {
  const shots = JSON.parse(readFileSync(join(repoDir, 'shots.json'), 'utf8'));
  const server = await startServer(repoDir);
  const { browser, page } = await launchBrowser();
  try {
    for (const shot of shots) {
      await page.goto(`${BASE}/${shot.query}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__shotReady, null, { timeout: 10000 });
      let quality = 82;
      let buffer = await page.screenshot({ type: 'jpeg', quality });
      while (buffer.length > MAX_BYTES && quality > 50) {
        quality -= 8;
        buffer = await page.screenshot({ type: 'jpeg', quality });
      }
      const path = join(repoDir, 'screenshots', shot.name);
      writeFileSync(path, buffer);
      const size = statSync(path).size;
      console.log(`SHOT ${shot.name}: ${size} bytes (quality ${quality}, 1280x720)${size > MAX_BYTES ? ' OVER CAP' : ''}`);
      if (size > MAX_BYTES) process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('SHOTS: done');
}

main().catch((error) => {
  console.error(`SHOTS ERROR: ${error.message}`);
  process.exit(1);
});
