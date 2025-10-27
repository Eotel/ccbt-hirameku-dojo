import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const outputDir = join(projectRoot, 'screenshots');

const sketches = [
  {
    id: '01_lsystem',
    title: 'L-System',
    file: join(projectRoot, 'sketchs', '01_lsystem', 'index.html'),
    wait: 800,
    actions: async (page) => {
      await page.waitForFunction(() => typeof window.regenerateTree === 'function');
      await page.evaluate(() => {
        SETTINGS.iterations = 5;
        SETTINGS.baseHue = 300;
        if (typeof regenerateTree === 'function') {
          regenerateTree();
        }
      });
      await page.waitForTimeout(300);
    }
  },
  {
    id: '02_voronoi',
    title: 'Voronoi',
    file: join(projectRoot, 'sketchs', '02_voronoi', 'index.html'),
    wait: 1200,
    actions: async (page) => {
      await page.waitForFunction(() => typeof window.randomizePoints === 'function');
      await page.evaluate(() => {
        SETTINGS.paletteName = 'reef';
        SETTINGS.initialPoints = 18;
        if (typeof randomizePoints === 'function') {
          randomizePoints();
        }
        if (typeof rebuildVoronoi === 'function') {
          rebuildVoronoi();
        }
      });
      await page.waitForTimeout(300);
    }
  },
  {
    id: '03_perlin_noise',
    title: 'Perlin Noise',
    file: join(projectRoot, 'sketchs', '03_perlin_noise', 'index.html'),
    wait: 1800,
    actions: async (page) => {
      await page.waitForFunction(() => typeof window.requestRender === 'function');
      await page.evaluate(() => {
        SETTINGS.palette = 'aurora';
        SETTINGS.showContour = true;
        SETTINGS.animate = false;
        if (typeof noLoop === 'function') {
          noLoop();
        }
        if (typeof requestRender === 'function') {
          requestRender();
        }
      });
      await page.waitForTimeout(300);
    }
  },
  {
    id: '04_cellular_automaton',
    title: 'Cellular Automaton',
    file: join(projectRoot, 'sketchs', '04_cellular_automaton', 'index.html'),
    wait: 1600,
    actions: async (page) => {
      await page.waitForFunction(() => typeof window.rebuild === 'function');
      await page.evaluate(() => {
        SETTINGS.ruleNumber = 90;
        SETTINGS.seedMode = 'two';
        SETTINGS.autoPlay = false;
        if (typeof rebuild === 'function') {
          rebuild();
        }
        if (typeof advanceRows === 'function') {
          advanceRows(40);
        }
      });
      await page.waitForTimeout(300);
    }
  }
];

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--allow-file-access-from-files']
  });
  const context = await browser.newContext({
    viewport: { width: 1100, height: 800 }
  });

  try {
    for (const sketch of sketches) {
      const page = await context.newPage();
      const url = `file://${sketch.file}`;
      console.log(`Capturing ${sketch.title} → ${url}`);
      await page.goto(url, { waitUntil: 'load', timeout: 0 });
      await page.waitForSelector('#canvas-container canvas', { timeout: 10000 });

      if (typeof sketch.actions === 'function') {
        await sketch.actions(page);
      }

      await delay(sketch.wait);

      const canvasLocator = page.locator('#canvas-container canvas');
      const screenshotPath = join(outputDir, `${sketch.id}.png`);
      if (await canvasLocator.count()) {
        await canvasLocator.first().screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      await page.close();
      console.log(`✔ 保存しました: ${screenshotPath}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log('すべてのスクリーンショット取得が完了しました。');
}

main().catch((error) => {
  console.error('スクリーンショットの取得に失敗しました:', error);
  process.exitCode = 1;
});
