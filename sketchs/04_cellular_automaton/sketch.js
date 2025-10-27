const SETTINGS = {
    canvasWidth: 800,
    canvasHeight: 600,
    ruleNumber: 110,
    cellSize: 6,
    wrapEdges: true,
    autoPlay: true,
    seedMode: 'center', // 'center', 'two', 'random'
    gradientTop: [255, 232, 214],
    gradientBottom: [169, 120, 221],
    highlightColor: [255, 255, 255],
    frameInterval: 2,
    randomSeed: 2025
};

const BASE_CANVAS_WIDTH = SETTINGS.canvasWidth || 800;
const BASE_CANVAS_HEIGHT = SETTINGS.canvasHeight || 600;
const CANVAS_ASPECT_RATIO = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;

let cols = 0;
let rows = 0;
let generations = [];
let lookupTable = {};
let visibleRows = 1;
let frameCounter = 0;

function setup() {
    const initialSize = computeCanvasSize();
    SETTINGS.canvasWidth = initialSize.width;
    SETTINGS.canvasHeight = initialSize.height;

    const canvas = createCanvas(initialSize.width, initialSize.height);
    attachCanvas(canvas);
    pixelDensity(1);
    frameRate(30);

    if (Number.isFinite(SETTINGS.randomSeed)) {
        randomSeed(SETTINGS.randomSeed);
    }

    rebuild();

    if (!SETTINGS.autoPlay) {
        noLoop();
        redraw();
    }
}

function draw() {
    background(
        SETTINGS.gradientBottom[0],
        SETTINGS.gradientBottom[1],
        SETTINGS.gradientBottom[2]
    );
    noStroke();

    const totalRows = Math.min(visibleRows, generations.length);

    for (let y = 0; y < totalRows; y++) {
        const row = generations[y];
        const t = y / Math.max(rows - 1, 1);
        const fillColor = lerpColorArray(SETTINGS.gradientTop, SETTINGS.gradientBottom, t);
        fill(fillColor[0], fillColor[1], fillColor[2]);
        for (let x = 0; x < cols; x++) {
            if (row[x] === 1) {
                rect(x * SETTINGS.cellSize, y * SETTINGS.cellSize, SETTINGS.cellSize, SETTINGS.cellSize);
            }
        }
    }

    if (totalRows < rows) {
        fill(SETTINGS.highlightColor[0], SETTINGS.highlightColor[1], SETTINGS.highlightColor[2], 120);
        rect(0, totalRows * SETTINGS.cellSize, width, SETTINGS.cellSize);
    }

    drawOverlay(totalRows);
    updateStatusPanel(totalRows);

    if (SETTINGS.autoPlay && visibleRows < rows) {
        frameCounter++;
        if (frameCounter % SETTINGS.frameInterval === 0) {
            visibleRows++;
        }
    }
}

function rebuild() {
    cols = Math.floor(width / SETTINGS.cellSize);
    rows = Math.floor(height / SETTINGS.cellSize);
    buildLookupTable(SETTINGS.ruleNumber);
    generateGenerations();
    visibleRows = 1;
    frameCounter = 0;
    requestRender();
}

function buildLookupTable(ruleNumber) {
    const binary = ruleNumber.toString(2).padStart(8, '0');
    const patterns = ['111', '110', '101', '100', '011', '010', '001', '000'];
    lookupTable = {};
    for (let i = 0; i < patterns.length; i++) {
        lookupTable[patterns[i]] = parseInt(binary[i], 10);
    }
}

function generateGenerations() {
    generations = [];
    const firstRow = createSeedRow(cols, SETTINGS.seedMode);
    generations.push(firstRow);
    for (let r = 1; r < rows; r++) {
        generations.push(nextRow(generations[r - 1]));
    }
}

function createSeedRow(length, mode) {
    const row = new Array(length).fill(0);
    if (mode === 'center') {
        row[Math.floor(length / 2)] = 1;
    } else if (mode === 'two') {
        row[Math.floor(length / 3)] = 1;
        row[Math.floor((length * 2) / 3)] = 1;
    } else {
        for (let i = 0; i < length; i++) {
            row[i] = random() > 0.5 ? 1 : 0;
        }
    }
    return row;
}

function nextRow(previous) {
    const next = new Array(previous.length).fill(0);
    for (let i = 0; i < previous.length; i++) {
        const left = SETTINGS.wrapEdges
            ? previous[(i - 1 + previous.length) % previous.length]
            : previous[i - 1] || 0;
        const center = previous[i];
        const right = SETTINGS.wrapEdges
            ? previous[(i + 1) % previous.length]
            : previous[i + 1] || 0;
        const key = `${left}${center}${right}`;
        next[i] = lookupTable[key];
    }
    return next;
}

function lerpColorArray(a, b, t) {
    return [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t)
    ];
}

function drawOverlay(totalRows) {
    resetMatrix();
    noStroke();
    fill(42, 24, 68, 185);
    rect(18, height - 116, 320, 100, 14);
    fill(255);
    textAlign(LEFT, TOP);
    textSize(13);
    const binary = SETTINGS.ruleNumber.toString(2).padStart(8, '0');
    text(
        `rule ${SETTINGS.ruleNumber}  rows ${totalRows}/${rows}\nseed=${SETTINGS.seedMode}  wrap=${SETTINGS.wrapEdges ? 'on' : 'off'}\n`
        + `bits: ${binary.slice(0, 4)} ${binary.slice(4)}`,
        30,
        height - 104
    );

    textAlign(RIGHT, BOTTOM);
    textSize(12);
    text('Space:再生/停止  →:1行進める  r:リセット  s:保存', width - 24, height - 20);
}

function requestRender() {
    redraw();
}

function advanceRows(count) {
    visibleRows = constrain(visibleRows + count, 1, rows);
    requestRender();
}

function toggleAutoPlay() {
    SETTINGS.autoPlay = !SETTINGS.autoPlay;
    if (SETTINGS.autoPlay) {
        loop();
    } else {
        noLoop();
    }
    updateStatusPanel(Math.min(visibleRows, generations.length));
}

function updateStatusPanel(totalRows) {
    const panel = document.getElementById('status-panel');
    if (!panel) return;

    panel.innerHTML = `
    <p><strong>ruleNumber</strong>: ${SETTINGS.ruleNumber}</p>
    <p><strong>seedMode</strong>: ${SETTINGS.seedMode}</p>
    <p><strong>wrapEdges</strong>: ${SETTINGS.wrapEdges ? 'true' : 'false'}</p>
    <p><strong>autoPlay</strong>: ${SETTINGS.autoPlay ? 'true' : 'false'} (${SETTINGS.frameInterval}f/step)</p>
    <p><strong>表示行</strong>: ${totalRows}/${rows}</p>
    <p class="refresh-hint">値を変えたら保存→リロードで反映されます。</p>
  `;
}

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        toggleAutoPlay();
    }
    if (event.key === 'ArrowRight') {
        advanceRows(1);
    }
    if (event.key === 'r') {
        rebuild();
    }
    if (event.key === 's') {
        saveCanvas(`cellular_rule_${SETTINGS.ruleNumber}`, 'png');
    }
});

function windowResized() {
    const nextSize = computeCanvasSize();
    if (nextSize.width === width && nextSize.height === height) {
        return;
    }

    resizeCanvas(nextSize.width, nextSize.height);
    SETTINGS.canvasWidth = nextSize.width;
    SETTINGS.canvasHeight = nextSize.height;

    rebuild();
}

function attachCanvas(canvas) {
    if (!canvas || typeof canvas.parent !== 'function') {
        return;
    }
    const container = document.getElementById('canvas-container');
    if (container) {
        canvas.parent(container);
    } else {
        canvas.parent(document.body);
    }
}

function computeCanvasSize() {
    if (typeof window === 'undefined') {
        return {
            width: BASE_CANVAS_WIDTH,
            height: BASE_CANVAS_HEIGHT
        };
    }

    const minWidth = 320;
    const minHeight = 240;
    const marginX = 48;
    const marginY = 200;

    const container = document.getElementById('canvas-container');
    const containerWidth = container && container.clientWidth ? Math.max(minWidth, container.clientWidth) : null;
    const containerHeight = container && container.clientHeight ? Math.max(minHeight, container.clientHeight) : null;

    const safeWindowWidth = Math.max(minWidth, window.innerWidth - marginX);
    let maxUsableWidth = safeWindowWidth;
    if (Number.isFinite(containerWidth)) {
        maxUsableWidth = Math.min(maxUsableWidth, containerWidth);
    }
    maxUsableWidth = Math.max(minWidth, maxUsableWidth);

    let width = Math.round(maxUsableWidth);
    let height = Math.round(width / CANVAS_ASPECT_RATIO);

    const safeWindowHeight = Math.max(minHeight, window.innerHeight - marginY);
    let maxUsableHeight = safeWindowHeight;
    if (Number.isFinite(containerHeight) && containerHeight > 0) {
        maxUsableHeight = Math.min(maxUsableHeight, containerHeight);
    }
    maxUsableHeight = Math.max(minHeight, maxUsableHeight);

    if (height > maxUsableHeight) {
        height = Math.round(maxUsableHeight);
        width = Math.round(height * CANVAS_ASPECT_RATIO);
        width = Math.min(width, maxUsableWidth);
    }

    width = Math.max(minWidth, Math.min(width, maxUsableWidth));
    height = Math.max(minHeight, height);

    return {width, height};
}
