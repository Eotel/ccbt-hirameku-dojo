/**
 * スケッチのスクリーンショットテストシステム
 *
 * 各スケッチを自動で起動し、スクリーンショットを撮影してデバッグに使用できます。
 *
 * 実行方法:
 * 1. npm install -D playwright
 * 2. npx playwright install chromium
 * 3. node test-screenshots.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const sketches = [
  {
    name: '01_lsystem',
    path: 'sketchs/01_lsystem/index.html',
    wait: 2000,
    actions: async (page) => {
      // デフォルト状態でスクリーンショット
      await page.waitForTimeout(1000);
    }
  },
  {
    name: '02_voronoi',
    path: 'sketchs/02_voronoi/index.html',
    wait: 2000,
    actions: async (page) => {
      // 初期状態を待つ
      await page.waitForTimeout(1000);
    }
  },
  {
    name: '03_perlin_noise',
    path: 'sketchs/03_perlin_noise/index.html',
    wait: 2000,
    actions: async (page) => {
      // 地形モードでスクリーンショット
      await page.waitForTimeout(1000);
    }
  },
  {
    name: '04_cellular_automaton',
    path: 'sketchs/04_cellular_automaton/index.html',
    wait: 2000,
    actions: async (page) => {
      // スタートボタンをクリックして実行
      await page.click('#start-btn');
      await page.waitForTimeout(1500);
    }
  }
];

async function captureScreenshots() {
  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1024 }
  });

  // スクリーンショット保存ディレクトリ
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('🎨 スクリーンショットテストを開始します...\n');

  for (const sketch of sketches) {
    console.log(`📸 ${sketch.name} を処理中...`);

    const page = await context.newPage();

    try {
      // ローカルファイルを開く
      const filePath = `file://${path.join(__dirname, sketch.path)}`;
      await page.goto(filePath);

      // ページの読み込みを待つ
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(sketch.wait);

      // カスタムアクションを実行
      if (sketch.actions) {
        await sketch.actions(page);
      }

      // スクリーンショットを撮影
      const screenshotPath = path.join(screenshotDir, `${sketch.name}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });

      console.log(`  ✅ 保存: ${screenshotPath}`);

      // canvas要素のみのスクリーンショットも撮影
      const canvas = await page.$('canvas');
      if (canvas) {
        const canvasPath = path.join(screenshotDir, `${sketch.name}_canvas.png`);
        await canvas.screenshot({ path: canvasPath });
        console.log(`  ✅ Canvas保存: ${canvasPath}`);
      }

    } catch (error) {
      console.error(`  ❌ エラー: ${error.message}`);
    } finally {
      await page.close();
    }

    console.log('');
  }

  await context.close();
  await browser.close();

  console.log('✨ すべてのスクリーンショット撮影が完了しました！');
  console.log(`📁 保存先: ${screenshotDir}`);
}

// メイン実行
captureScreenshots().catch(console.error);
