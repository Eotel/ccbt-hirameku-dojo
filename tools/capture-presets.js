import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const outputDir = join(projectRoot, 'screenshots');

const ALL_PRESETS = [
  'spreadingTree',
  'detailedPlant',
  'alternatingTree',
  'symmetricTree',
  'randomBush',
  'snowCrystal',
  'trianglePattern',
  'dragonCurve'
];

async function capturePreset(page, presetKey) {
    console.log(`  プリセット "${presetKey}" を適用中...`);

    await page.evaluate((key) => {
        if (window.LSYSTEM_APP && typeof window.LSYSTEM_APP.applyPreset === 'function') {
            window.LSYSTEM_APP.applyPreset(key);
        }
    }, presetKey);

    await delay(500);

  const canvasLocator = page.locator('#canvas-container canvas');
  const screenshotPath = join(outputDir, `01_lsystem_${presetKey}.png`);

  if (await canvasLocator.count()) {
    await canvasLocator.first().screenshot({ path: screenshotPath });
    console.log(`  ✔ 保存しました: ${screenshotPath}`);
  } else {
    console.warn(`  ⚠ canvas が見つかりませんでした`);
  }
}

async function suppressInlineGui(page) {
    await page.evaluate(() => {
        window.__LSYSTEM_CAPTURE_MODE = true;

        if (window.__LSYSTEM_GUI_INSTANCE && typeof window.__LSYSTEM_GUI_INSTANCE.destroy === 'function') {
            window.__LSYSTEM_GUI_INSTANCE.destroy();
        }

        const guiNodes = document.querySelectorAll('.lsystem-gui, .dg');
        guiNodes.forEach((node) => node.remove());

        window.__LSYSTEM_GUI_MODE = 'headless';

        if (window.LSYSTEM_APP) {
            if (typeof window.LSYSTEM_APP.ensureGui === 'function') {
                window.LSYSTEM_APP.ensureGui = () => {};
            }
            if (typeof window.LSYSTEM_APP.maybeAttachInlineGui === 'function') {
                window.LSYSTEM_APP.maybeAttachInlineGui = () => {};
            }
        }
    });

    await page.addStyleTag({content: '.lsystem-gui{display:none !important;}.dg{display:none !important;}'});
}

async function main() {
  const args = process.argv.slice(2);
  const presetsToCapture = args.length > 0 ? args : ALL_PRESETS;

  console.log(`プリセットをキャプチャします: ${presetsToCapture.join(', ')}`);

  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files']
  });

    const context = await browser.newContext({
        viewport: { width: 1100, height: 900 }
    });

    await context.addInitScript(() => {
        window.__LSYSTEM_CAPTURE_MODE = true;
    });

    try {
        const page = await context.newPage();
    const localHtmlPath = join(projectRoot, 'sketchs', '01_lsystem', 'local.html');
    const url = `file://${localHtmlPath}`;

    console.log(`\nローカルページを開いています: ${url}`);
    await page.goto(url, { waitUntil: 'load', timeout: 0 });

    // LSYSTEM_APP が準備できるまで待機
    await page.waitForFunction(() => window.LSYSTEM_APP && typeof window.LSYSTEM_APP.applyPreset === 'function', {
        timeout: 10000
    });

    await suppressInlineGui(page);

    await delay(1000);

    for (const presetKey of presetsToCapture) {
        await capturePreset(page, presetKey);
    }

    await page.close();
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('\nすべてのプリセットキャプチャが完了しました。');
}

main().catch((error) => {
  console.error('プリセットキャプチャに失敗しました:', error);
  process.exitCode = 1;
});
