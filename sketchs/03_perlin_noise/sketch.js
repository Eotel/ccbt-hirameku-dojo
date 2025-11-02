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
let shapeKit = null;

const BASE_COLOR_HEX = '#00EEFF';
let baseColor;
let baseHueValue = 0;
let baseSatValue = 0;
let baseBriValue = 0;

const HUE_JITTER = 35;       // 基準色からどれだけ色相を揺らすか（度）
const SATURATION_JITTER = 20; // 彩度ノイズの振れ幅
const BRIGHTNESS_JITTER = 25; // 明度ノイズの振れ幅

// 好みで追加OK：ASCIIの候補
const ASCII_SETS_DEFAULT = [['.', ':', '*', 'o', 'O', '#', '@'], ['-', '/', '|', '\\', '+'], ['<', '^', '>', 'v'], ['□', '■'], ['░', '▒', '▓', '█']];

let asciiSets = ASCII_SETS_DEFAULT.map((set) => [...set]);

function setup() {
    const canvas = createCanvas(windowWidth, windowHeight);
    const container = document.getElementById('canvas-container');
    if (container) {
        canvas.parent(container);
        const hint = container.querySelector('.loading-hint');
        if (hint) hint.remove();
    }
    colorMode(HSB, 360, 100, 100, 1);
    baseColor = color(BASE_COLOR_HEX);
    baseHueValue = hue(baseColor);
    baseSatValue = saturation(baseColor);
    baseBriValue = brightness(baseColor);
    textAlign(CENTER, CENTER);
    textFont('monospace');
    strokeCap(SQUARE);
    if (typeof Shapes !== 'undefined' && Shapes && typeof Shapes.create === 'function') {
        shapeKit = Shapes.create();
    }
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

    const cell = min(width / gridX, height / gridY); // 正方形セルの一辺
    const offsetX = (width - cell * gridX) * 0.5;
    const offsetY = (height - cell * gridY) * 0.5;
    const cw = cell;
    const ch = cell;

    // グリッドを走査
    for (let j = 0; j < gridY; j++) {
        for (let i = 0; i < gridX; i++) {
            const x = offsetX + (i + 0.5) * cw; // マス中心
            const y = offsetY + (j + 0.5) * ch;

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
    if (!baseColor) {
        baseColor = color(BASE_COLOR_HEX);
        baseHueValue = hue(baseColor);
        baseSatValue = saturation(baseColor);
        baseBriValue = brightness(baseColor);
    }
    const hueOffset = map(nH, 0, 1, -HUE_JITTER, HUE_JITTER);
    const satOffset = map(nS, 0, 1, -SATURATION_JITTER, SATURATION_JITTER);
    const briOffset = map(nB, 0, 1, -BRIGHTNESS_JITTER, BRIGHTNESS_JITTER);

    const nextHue = (baseHueValue + hueOffset + 360) % 360;
    const nextSat = constrain(baseSatValue + satOffset, 0, 100);
    const nextBri = constrain(baseBriValue + briOffset, 0, 100);
    fill(nextHue, nextSat, nextBri, 1);
    rectMode(CENTER);
    rect(x, y, w, h);
}

// 3) ベクターフィールド：ノイズ角度に矢印を向けて動かす
function drawVector(cx, cy, w, h, ang, mag) {
    push();
    translate(cx, cy);
    rotate(ang);

    const len = min(w, h) * 0.95; // グリッドいっぱいの長さ
    const half = len / 2;

    if (useStroke) {
        stroke(220, 40, 30, 0.9);
        strokeWeight(map(mag, 0, 1, 1.5, 3));
    } else {
        noStroke();
    }

    line(-half, 0, half, 0);
    pop();
}

// 4) ASCIIアート：角度や強さから文字を選ぶ
function drawASCII(cx, cy, w, h, ang, mag, n) {
    if (asciiSets.length === 0) return;
    const set = asciiSets[asciiIndex % asciiSets.length];
    if (!set || set.length === 0) return;

    // ノイズ値は端に寄りづらいので補正をかけ、配列末尾の文字も出やすくする
    let normalized = constrain(map(mag, 0.18, 0.82, 0, 1), 0, 1);
    normalized = 1 - pow(1 - normalized, 2); // easeOutQuad で高値を強調

    // 二つのやり方から一つ選ぶ（コメントアウトで切替）
    // A) 強さで選ぶ
    let idx = floor(normalized * set.length);
    // B) 角度で選ぶ（試してみよう）
    // let idx = floor(map((ang + TWO_PI) % TWO_PI, 0, TWO_PI, 0, set.length));

    idx = constrain(idx, 0, set.length - 1);
    const ch = set[idx];

    // 文字サイズはマスに合わせる
    const ts = min(w, h) * 0.8;
    textSize(ts);

    // 色は白か濃い色を選ぶ例
    if (idx > set.length / 2) fill(0, 0, 10); else fill(0, 0, 0);

    if (useStroke) {
        stroke(0, 0, 100);
        strokeWeight(0.5);
    } else noStroke();
    text(ch, cx, cy);
}

// 5) 図形いろいろ：形・色・大きさ・角度をノイズで
function drawShapes(cx, cy, w, h, ang, mag, n1, n2, n3) {
    const s = min(w, h); // セル基準サイズ（形状の最大寸法）
    const sw = 2; // 輪郭線の太さをまとめて調整したい場合はここを変更

    // --- ノイズ値の役割 ---
    // n1: 0→小さく / 1→大きく。ここを書き換えるとサイズの変化幅が変わる。
    const sz = s * map(n1, 0, 1, 0.35, 0.95);
    // n2: 色相を決める。色の範囲を変えたい場合は 190,300 を別の色相に。
    const hue = map(n2, 0, 1, 190, 300);
    // n3: 明るさを決める。40,95 を変えると暗め・明るめ方向へ振れる。
    const bri = map(n3, 0, 1, 40, 95);
    // mag: ベクトルの強さ。ここでは彩度に使っているので淡い→鮮やかの幅を調整可能。
    const sat = map(mag, 0, 1, 30, 95);

    if (!shapeKit) {
        // shapeKit が無いときはシンプルな図形を手動で描画
        push();
        translate(cx, cy);
        rotate(ang);
        if (useStroke) {
            stroke(0, 0, 0);
            strokeWeight(sw);
        } else noStroke();
        fill(hue, sat, bri, 1);
        // n1 を使って 3 つの形状から選択。分岐を増やせば種類を追加できる。
        const which = floor(map(n1, 0, 1, 0, 3));
        if (which === 0) {
            rectMode(CENTER);
            rect(0, 0, sz, sz, s * 0.08); // 角丸正方形
        } else if (which === 1) {
            ellipse(0, 0, sz, sz);
        } else {
            rectMode(CENTER);
            rect(0, 0, sz * 0.65, sz * 0.25);
        }
        pop();
        return;
    }

    const fillColor = color(hue, sat, bri, 1);
    const strokeColor = useStroke ? color(0, 0, 0) : null;
    const base = {
        x: cx, y: cy, rotation: ang, fill: fillColor, stroke: strokeColor, strokeWeight: useStroke ? sw : undefined
    };


    const choice = floor(map(n1, 0, 1, 0, 4)); // 図形バリエーションを増やしたい場合はここを調整
    if (choice === 0) {
        shapeKit.rect({
            ...base, width: sz, height: sz, radius: s * 0.08
        });
    } else if (choice === 1) {
        shapeKit.circle({
            ...base, diameter: sz
        });

        // shapeKit を使って同じセルに同心図形を重ねたい場合の例。
        // 以下のブロックをコメント解除すると、サイズを 0.2 ずつ減らした円が描画される。
        // 好みで circle → rect へ差し替えたり、scale のリストを書き換えてパターンを作成できる。

        // for (let scale = 0.8; scale >= 0.2; scale -= 0.2) {
        //     shapeKit.circle({
        //         ...base,
        //         diameter: sz * scale,
        //         fill: fillColor,
        //         stroke: strokeColor
        //     });
        // }
    } else if (choice === 2) {
        shapeKit.diamond({
            ...base, diameter: sz, aspectRatio: map(n2, 0, 1, 0.6, 1.4)
        });
    } else {
        shapeKit.star({
            ...base,
            diameter: sz * 1.1,
            spikes: max(3, floor(map(n3, 0, 1, 4, 8))),
            innerScale: map(mag, 0, 1, 0.35, 0.6)
        });
    }
}

/* --- HUDと補助 --- */

function drawHUD() {
    const totalSets = asciiSets.length;
    const lines = [`モード: ${mode}  1=白黒  2=HSB  3=ベクター  4=ASCII  5=図形`, `グリッド: ${gridX} × ${gridY}  [ / ]`, `ノイズ細かさ: ${nf(noiseScale, 1, 3)}  N ↑  M ↓`, `アニメ速度: ${nf(timeSpeed, 1, 3)}  V ↑  B ↓`, `線の描画: ${useStroke ? 'あり' : 'なし'}  O`, `ガイド格子: ${showGrid ? '表示' : '非表示'}  G`, `ASCIIセット: ${asciiIndex % max(1, totalSets)} / ${max(1, totalSets)}  C=切替  Shift+C=追加`, `シード: ${seed}  R=入替  Space=${animate ? '一時停止' : '再生'}  S=保存`];
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

    if (key === 'C') {
        requestAsciiSetFromPrompt();
        return;
    }

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

function addAsciiSet(chars) {
    if (!chars) return false;
    let set;
    if (typeof chars === 'string') {
        const trimmed = chars.trim();
        if (!trimmed) return false;
        set = Array.from(trimmed);
    } else if (Array.isArray(chars)) {
        set = chars.map((ch) => String(ch)).filter((ch) => ch.length > 0);
    } else {
        return false;
    }

    if (set.length === 0) return false;
    asciiSets = [...asciiSets, set];
    asciiIndex = asciiSets.length - 1;
    return true;
}

function resetAsciiSets() {
    asciiSets = ASCII_SETS_DEFAULT.map((set) => [...set]);
    asciiIndex = 0;
}

function requestAsciiSetFromPrompt() {
    if (typeof prompt !== 'function') return;
    const message = '新しい ASCII セットを入力してください（例: .:*oO#@）。半角スペースは区切りになります。';
    const input = prompt(message, '');
    if (!input) return;

    const normalized = input
        .split(/\s+/)
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0);

    if (normalized.length === 0) return;

    normalized.forEach((chunk) => {
        addAsciiSet(chunk);
    });
}

if (typeof window !== 'undefined') {
    window.AsciiPatterns = {
        add: addAsciiSet, list: () => asciiSets.map((set) => [...set]), reset: resetAsciiSets
    };
}
