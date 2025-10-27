const SETTINGS = {
    canvasWidth: 800,
    canvasHeight: 600,
    initialPoints: 12,
    jitterAmount: 0.35,
    showEdges: true,
    showSeeds: true,
    highlightHover: true,
    paletteName: 'giraffe',
    noiseScale: 0.015,
    randomSeed: 2025
};

const BASE_CANVAS_WIDTH = SETTINGS.canvasWidth || 800;
const BASE_CANVAS_HEIGHT = SETTINGS.canvasHeight || 600;
const CANVAS_ASPECT_RATIO = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;

const PALETTES = {
    giraffe: [
        [198, 134, 66],
        [171, 105, 50],
        [227, 177, 117],
        [145, 92, 45],
        [214, 161, 99]
    ],
    desert: [
        [210, 152, 75],
        [179, 116, 62],
        [235, 198, 160],
        [132, 88, 46],
        [96, 60, 42]
    ],
    reef: [
        [32, 105, 151],
        [54, 147, 207],
        [78, 185, 208],
        [247, 197, 91],
        [232, 127, 62]
    ],
    grayscale: [
        [60, 60, 60],
        [110, 110, 110],
        [170, 170, 170],
        [220, 220, 220]
    ]
};

let points = [];
let delaunay = null;
let voronoi = null;
let noiseOffset = (SETTINGS.randomSeed ?? Math.random() * 1000) * 0.37;
let hoveredIndex = -1;

function setup() {
    const initialSize = computeCanvasSize();
    SETTINGS.canvasWidth = initialSize.width;
    SETTINGS.canvasHeight = initialSize.height;

    const canvas = createCanvas(initialSize.width, initialSize.height);
    attachCanvas(canvas);
    pixelDensity(1);

    if (Number.isFinite(SETTINGS.randomSeed)) {
        randomSeed(SETTINGS.randomSeed);
    }

    initPoints(SETTINGS.initialPoints);
    rebuildVoronoi();
    noLoop();
    redraw();

    canvas.mouseClicked(() => {
        if (mouseInsideCanvas()) {
            points.push([mouseX, mouseY]);
            rebuildVoronoi();
            redraw();
        }
    });
}

function draw() {
    background(252, 247, 239);
    noStroke();

    hoveredIndex = mouseInsideCanvas() && delaunay ? delaunay.find(mouseX, mouseY) : -1;

    if (!voronoi) {
        drawEmptyMessage();
        updateStatusPanel();
        return;
    }

    const palette = PALETTES[SETTINGS.paletteName] ?? PALETTES.giraffe;

    for (let i = 0; i < points.length; i++) {
        const polygon = voronoi.cellPolygon(i);
        if (!polygon) continue;

        const base = palette[i % palette.length];
        const jitter = SETTINGS.jitterAmount;
        const n = noise(
            points[i][0] * SETTINGS.noiseScale + noiseOffset,
            points[i][1] * SETTINGS.noiseScale + noiseOffset,
            jitter * 4
        );

        const shade = lerp(0.75, 1.1, constrain(n + jitter * 0.4, 0, 1));
        const r = constrain(base[0] * shade, 0, 255);
        const g = constrain(base[1] * shade, 0, 255);
        const b = constrain(base[2] * shade, 0, 255);

        if (SETTINGS.highlightHover && i === hoveredIndex) {
            fill(r, g, b, 235);
        } else {
            fill(r, g, b, 210);
        }

        beginShape();
        for (const [x, y] of polygon) {
            vertex(x, y);
        }
        endShape(CLOSE);

        if (SETTINGS.showEdges) {
            stroke(90, 60, 30, i === hoveredIndex ? 230 : 180);
            strokeWeight(i === hoveredIndex ? 2.4 : 1.6);
            noFill();
            beginShape();
            for (const [x, y] of polygon) {
                vertex(x, y);
            }
            endShape(CLOSE);
            noStroke();
        }
    }

    if (SETTINGS.showSeeds) {
        stroke(90, 60, 30, 220);
        for (let i = 0; i < points.length; i++) {
            const [x, y] = points[i];
            const size = SETTINGS.highlightHover && i === hoveredIndex ? 10 : 8;
            fill(255, 255, 255, 220);
            circle(x, y, size);
        }
        noStroke();
    }

    drawOverlay();
    updateStatusPanel();
}

function mouseMoved() {
    if (!voronoi) return;
    if (SETTINGS.highlightHover && mouseInsideCanvas()) {
        redraw();
    }
}

function initPoints(count) {
    points = [];
    for (let i = 0; i < count; i++) {
        points.push([random(width), random(height)]);
    }
}

function rebuildVoronoi() {
    if (points.length === 0) {
        delaunay = null;
        voronoi = null;
        return;
    }
    delaunay = d3.Delaunay.from(points);
    voronoi = delaunay.voronoi([0, 0, width, height]);
}

function mouseInsideCanvas() {
    return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function drawEmptyMessage() {
    fill(96, 70, 40);
    textAlign(CENTER, CENTER);
    textSize(20);
    text('クリックで点を追加し、最も近い点の領域を観察しよう', width / 2, height / 2);
}

function drawOverlay() {
    resetMatrix();
    noStroke();
    fill(96, 70, 40, 180);
    rect(18, height - 94, 300, 86, 12);
    fill(255);
    textAlign(LEFT, TOP);
    textSize(13);
    text(
        `points: ${points.length}\njitter: ${SETTINGS.jitterAmount.toFixed(2)}  palette: ${SETTINGS.paletteName}`,
        32,
        height - 84
    );
    textAlign(RIGHT, BOTTOM);
    textSize(12);
    text('クリックで点追加 / r: 再配置 / c: クリア', width - 24, height - 20);
}

function updateStatusPanel() {
    const panel = document.getElementById('status-panel');
    if (!panel) return;

    panel.innerHTML = `
    <p><strong>現在の点</strong>: ${points.length}</p>
    <p><strong>initialPoints</strong>: ${SETTINGS.initialPoints}</p>
    <p><strong>jitterAmount</strong>: ${SETTINGS.jitterAmount.toFixed(2)}</p>
    <p><strong>showEdges</strong>: ${SETTINGS.showEdges ? 'true' : 'false'}</p>
    <p class="refresh-hint">値を変えたら保存→リロードで反映されます。</p>
  `;
}

function randomizePoints() {
    if (Number.isFinite(SETTINGS.randomSeed)) {
        randomSeed(SETTINGS.randomSeed + Math.floor(random(1000)));
    }
    initPoints(SETTINGS.initialPoints);
    noiseOffset = random(0, 1000);
    rebuildVoronoi();
    redraw();
}

function clearPoints() {
    points = [];
    rebuildVoronoi();
    redraw();
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'r') {
        randomizePoints();
    }
    if (event.key === 'c') {
        clearPoints();
    }
    if (event.key === 's') {
        saveCanvas(`voronoi_${points.length}`, 'png');
    }
});

function windowResized() {
    const nextSize = computeCanvasSize();
    if (nextSize.width === width && nextSize.height === height) {
        return;
    }

    const prevWidth = width;
    const prevHeight = height;

    resizeCanvas(nextSize.width, nextSize.height);
    SETTINGS.canvasWidth = nextSize.width;
    SETTINGS.canvasHeight = nextSize.height;

    if (prevWidth > 0 && prevHeight > 0) {
        points = points.map(([x, y]) => [
            (x / prevWidth) * nextSize.width,
            (y / prevHeight) * nextSize.height
        ]);
    }

    rebuildVoronoi();
    redraw();
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
