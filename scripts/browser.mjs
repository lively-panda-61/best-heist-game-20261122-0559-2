// Shared browser harness for the playtest and the screenshot run: starts the
// dev server, launches the Playwright Chromium that lives on this machine,
// and hands back a page at 1280x720.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('/home/hatch/workspace/makefun/tools/pw/node_modules/playwright-core');

export const PORT = 8137;

function findChromium() {
  const base = join(homedir(), '.cache', 'ms-playwright');
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith('chromium-')) continue;
    for (const sub of ['chrome-linux', 'chrome-linux64']) {
      const binary = join(base, dir, sub, 'chrome');
      if (existsSync(binary)) return binary;
    }
  }
  throw new Error(`no Chromium binary found under ${base}`);
}

export async function startServer(repoDir) {
  const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
    cwd: repoDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const url = `http://localhost:${PORT}/`;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return server;
    } catch {
      // Not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error('serve.ts did not come up in 10s');
}

export async function launchBrowser() {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => {
    console.error(`[pageerror] ${error.message}`);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[console.error] ${message.text()}`);
  });
  return { browser, page };
}
