/*
👶 ワークショップ教材：ノイズ × ベクターフィールド実験帳（p5.js / OpenProcessing）

学べること
- Perlin ノイズ（p5.js の noise()）で「角度」「長さ」「色」を決める
- ベクターフィールド（向きの地図）を作る
- グリッド上に図形や文字を置き、色・大きさ・角度をノイズで変える

操作
  [1] 白黒ノイズ
  [2] HSBカラー（色/彩度/明度をノイズで）
  [3] ベクターフィールド（矢印アニメ）
  [4] ASCIIアート（Cで文字セット変更）
  [5] 図形いろいろ（形/大きさ/角度がノイズで変化）

  [ と ] : グリッド密度
  N / M  : ノイズの細かさ（スケール）
  V / B  : アニメの速さ
  O      : 枠線ON/OFF
  G      : ガイド格子ON/OFF
  H      : 画面ヘルプON/OFF
  R      : 乱数シード入れ替え
  Space  : アニメ一時停止
  S      : 画像保存
*/

let gridX = 36;      // 横の分割数（増やすと細かくなる）
let gridY = 24;      // 縦の分割数
let mode = 1;       // 1..5 表示モード
let noiseScale = 0.015; // ノイズの細かさ（数値↑で細かく）
let timeSpeed = 0.003; // アニメ速度（0で静止）
let t = 0;             // 時間
let animate = true;

let showGrid = false;
let showHelp = true;
let useStroke = true;

let seed = 12345;   // noiseSeed と randomSeed をそろえる
let asciiIndex = 0; // どのASCIIセットを使うか

// 好みで追加OK：ASCIIの候補
const ASCII_SETS = [
    ['.', ':', '*', 'o', 'O', '#', '@'],
    ['-', '/', '|', '\\', '+'],
    ['<', '^', '>', 'v'],
    ['□', '■'],
    ['░', '▒', '▓', '█']
];

function setup() {
    createCanvas(windowWidth, windowHeight);
    colorMode(HSB, 360, 100, 100, 1);
    textAlign(CENTER, CENTER);
    textFont('monospace');
    strokeCap(SQUARE);
    reseed();
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
}

function reseed() {
    noiseSeed(seed);
    randomSeed(seed);
}

function draw() {
    // ベクターフィールドの残像を見たいときは mode===3 で背景を消さない
    if (!(mode === 3 && !useClearInVectorMode())) {
        background(0, 0, 95); // 薄いグレー
    }

    const cw = width / gridX;   // 1マスの幅
    const ch = height / gridY;   // 1マスの高さ

    // グリッドを走査
    for (let j = 0; j < gridY; j++) {
        for (let i = 0; i < gridX; i++) {
            const x = (i + 0.5) * cw; // マス中心
            const y = (j + 0.5) * ch;

            // 座標→ノイズ入力（スケールで拡大縮小）
            const nx = x * noiseScale;
            const ny = y * noiseScale;

            // 角度・強さ・色用に、ズラしたノイズを使う
            const ang = map(noise(nx + 100, ny + 200, t), 0, 1, 0, TWO_PI);
            const mag = noise(nx + 300, ny + 400, t);     // 0..1
            const n1 = noise(nx + 500, ny + 600, t);     // 汎用
            const n2 = noise(nx + 700, ny + 800, t);     // 汎用
            const n3 = noise(nx + 900, ny + 1000, t);    // 汎用

            switch (mode) {
                case 1:
                    drawBW(x, y, cw, ch, n1);
                    break;
                case 2:
                    drawHSB(x, y, cw, ch, n1, n2, n3);
                    break;
                case 3:
                    drawVector(x, y, cw, ch, ang, mag);
                    break;
                case 4:
                    drawASCII(x, y, cw, ch, ang, mag, n1);
                    break;
                case 5:
                    drawShapes(x, y, cw, ch, ang, mag, n1, n2, n3);
                    break;
            }

            if (showGrid) {
                noFill();
                stroke(0, 0, 60, 0.25);
                rectMode(CENTER);
                rect(x, y, cw, ch);
            }
        }
    }

    if (showHelp) drawHUD();

    if (animate) t += timeSpeed;
}

/* --- 各モードの描画 --- */

// 1) 白黒ノイズ：明るさだけをノイズで決める
function drawBW(x, y, w, h, n) {
    noStroke();
    fill(0, 0, map(n, 0, 1, 5, 95)); // 5..95% のグレー
    rectMode(CENTER);
    rect(x, y, w, h);
}

// 2) HSBカラー：色相・彩度・明度を別ノイズで決める
function drawHSB(x, y, w, h, nH, nS, nB) {
    noStroke();
    const hue = map(nH, 0, 1, 180, 320);   // 青〜紫
    const sat = map(nS, 0, 1, 30, 100);
    const bri = map(nB, 0, 1, 30, 100);
    fill(hue, sat, bri, 1);
    rectMode(CENTER);
    rect(x, y, w, h);
}

// 3) ベクターフィールド：ノイズ角度に矢印を向けて動かす
function drawVector(cx, cy, w, h, ang, mag) {
    const len = min(w, h) * map(mag, 0, 1, 0.25, 0.48);
    const x2 = cx + cos(ang) * len;
    const y2 = cy + sin(ang) * len;

    if (useStroke) stroke(220, 40, 30, 0.9);
    else noStroke();
    fill(220, 40, 40, 0.9);

    // 矢印の軸
    strokeWeight(2);
    line(cx, cy, x2, y2);

    // 矢印の先
    push();
    translate(x2, y2);
    rotate(ang);
    noStroke();
    triangle(0, 0, -len * 0.25, +len * 0.12, -len * 0.25, -len * 0.12);
    pop();
}

// 4) ASCIIアート：角度や強さから文字を選ぶ
function drawASCII(cx, cy, w, h, ang, mag, n) {
    const set = ASCII_SETS[asciiIndex % ASCII_SETS.length];

    // 二つのやり方から一つ選ぶ（コメントアウトで切替）
    // A) 強さで選ぶ
    let idx = floor(map(mag, 0, 1, 0, set.length));
    // B) 角度で選ぶ（試してみよう）
    // let idx = floor(map(ang, 0, TWO_PI, 0, set.length));

    idx = constrain(idx, 0, set.length - 1);
    const ch = set[idx];

    // 文字サイズはマスに合わせる
    const ts = min(w, h) * 0.8;
    textSize(ts);

    // 色は白か濃い色を選ぶ例
    if (idx > set.length / 2) fill(0, 0, 10);
    else fill(0, 0, 0);

    if (useStroke) {
        stroke(0, 0, 100);
        strokeWeight(0.5);
    } else noStroke();
    text(ch, cx, cy);
}

// 5) 図形いろいろ：形・色・大きさ・角度をノイズで
function drawShapes(cx, cy, w, h, ang, mag, n1, n2, n3) {
    const s = min(w, h);
    const sz = s * map(n1, 0, 1, 0.35, 0.95);  // 大きさ
    const hue = map(n2, 0, 1, 190, 300);       // 青〜紫
    const bri = map(n3, 0, 1, 40, 95);
    const sat = map(mag, 0, 1, 30, 95);

    push();
    translate(cx, cy);
    rotate(ang);

    if (useStroke) {
        stroke(0, 0, 0);
        strokeWeight(2);
    } else noStroke();
    fill(hue, sat, bri, 1);

    // 形の選び方：n1 で3種から選ぶ
    const which = floor(map(n1, 0, 1, 0, 3));
    if (which === 0) {
        rectMode(CENTER);
        rect(0, 0, sz, sz, s * 0.08); // 角丸正方形
        // 参考：入れ子の小さい四角（コメントを外すと表示）
        // fill(hue, sat*0.2, bri*0.8);
        // rect(0, 0, sz*0.55, sz*0.55, s*0.05);
    } else if (which === 1) {
        ellipse(0, 0, sz, sz);
    } else {
        // ひし形（回転した長方形）
        rectMode(CENTER);
        rect(0, 0, sz * 0.65, sz * 0.25);
    }
    pop();
}

/* --- HUDと補助 --- */

function drawHUD() {
    const lines = [
        `mode: ${mode}  [1]BW  [2]HSB  [3]Vector  [4]ASCII  [5]Shapes`,
        `grid: ${gridX} x ${gridY}  [ / ]`,
        `noiseScale: ${nf(noiseScale, 1, 3)}  N/M`,
        `timeSpeed:  ${nf(timeSpeed, 1, 3)}  V/B`,
        `stroke: ${useStroke ? 'ON' : 'OFF'}  O`,
        `grid line: ${showGrid ? 'ON' : 'OFF'}  G`,
        `ASCII set: ${asciiIndex % ASCII_SETS.length} / ${ASCII_SETS.length}  C`,
        `seed: ${seed}  R=reset  Space=${animate ? 'pause' : 'play'}  S=save`
    ];
    noStroke();
    fill(0, 0, 0, 0.7);
    rectMode(CORNER);
    // 背景パネル
    rect(12, 12, 420, 24 * (lines.length + 1), 10);
    // 文字
    fill(0, 0, 100);
    textSize(16);
    textAlign(LEFT, TOP);
    for (let k = 0; k < lines.length; k++) {
        text(lines[k], 24, 32 + 24 * k);
    }
    textAlign(CENTER, CENTER);
}

function keyPressed() {
    const k = key.toLowerCase();

    if (key === '1') mode = 1;
    if (key === '2') mode = 2;
    if (key === '3') mode = 3;
    if (key === '4') mode = 4;
    if (key === '5') mode = 5;

    if (key === '[') {
        gridX = max(6, floor(gridX * 0.9));
        gridY = max(6, floor(gridY * 0.9));
    }
    if (key === ']') {
        const nextGridX = min(200, floor(gridX * 1.1));
        const nextGridY = min(200, floor(gridY * 1.1));
        gridX = nextGridX === gridX ? min(200, gridX + 1) : nextGridX;
        gridY = nextGridY === gridY ? min(200, gridY + 1) : nextGridY;
    }

    if (k === 'n') noiseScale *= 1.1;
    if (k === 'm') noiseScale *= 0.9;

    if (k === 'v') timeSpeed *= 1.2;
    if (k === 'b') timeSpeed *= 0.8;

    if (key === ' ') animate = !animate;

    if (k === 'o') useStroke = !useStroke;
    if (k === 'g') showGrid = !showGrid;
    if (k === 'h') showHelp = !showHelp;

    if (k === 'c') asciiIndex++;

    if (k === 'r') {
        seed = floor(random(1e9));
        reseed();
    }

    if (k === 's') saveCanvas('noise_field', 'png');
}

function useClearInVectorMode() {
    // 残像を見たいときは false にする（ここを切り替えて試す）
    return true; // ← false にすると線が重なり流線っぽくなる
}
