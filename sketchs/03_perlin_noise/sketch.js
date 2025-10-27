const SETTINGS = {
    canvasWidth: 800,
    canvasHeight: 600,
    noiseScale: 0.02,
    detailLevel: 4,
    timeSpeed: 0.01,
    animate: true,
    showContour: false,
    contourDensity: 12,
    contourThreshold: 0.03,
    palette: 'cloud'
};

const BASE_CANVAS_WIDTH = SETTINGS.canvasWidth || 800;
const BASE_CANVAS_HEIGHT = SETTINGS.canvasHeight || 600;
const CANVAS_ASPECT_RATIO = BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;

const PALETTE_DEFINITIONS = {
    cloud: [
        [120, 170, 220],
        [210, 230, 255],
        [255, 255, 255]
    ],
    terrain: [
        [40, 80, 45],
        [108, 94, 64],
        [214, 198, 147]
    ],
    ocean: [
        [10, 60, 110],
        [30, 110, 160],
        [160, 220, 235]
    ],
    aurora: [
        [15, 40, 70],
        [70, 190, 170],
        [240, 120, 240]
    ]
};

const PALETTE_ORDER = Object.keys(PALETTE_DEFINITIONS);
const palettes = {};

let zOffset = 0;
let needsRedraw = true;

function setup() {
    const initialSize = computeCanvasSize();
    SETTINGS.canvasWidth = initialSize.width;
    SETTINGS.canvasHeight = initialSize.height;

    const canvas = createCanvas(initialSize.width, initialSize.height);
    attachCanvas(canvas);
    pixelDensity(1);
    frameRate(30);
    colorMode(RGB, 255);

    for (const [name, stops] of Object.entries(PALETTE_DEFINITIONS)) {
        palettes[name] = stops.map(([r, g, b]) => color(r, g, b));
    }

    noiseDetail(SETTINGS.detailLevel, 0.5);

    if (!SETTINGS.animate) {
        noLoop();
    }

    requestRender();
}

function draw() {
    if (!SETTINGS.animate && !needsRedraw) {
        return;
    }

    renderNoise();
    needsRedraw = false;

    if (SETTINGS.animate) {
        zOffset += SETTINGS.timeSpeed;
    }
}

function renderNoise() {
    loadPixels();
    const density = pixelDensity();
    const widthPixels = width * density;
    const heightPixels = height * density;

    for (let y = 0; y < heightPixels; y++) {
        for (let x = 0; x < widthPixels; x++) {
            const worldX = (x / density) * SETTINGS.noiseScale;
            const worldY = (y / density) * SETTINGS.noiseScale;
            const n = noise(worldX, worldY, zOffset);
            const rgba = samplePalette(SETTINGS.palette, n);
            const idx = 4 * (x + y * widthPixels);

            if (SETTINGS.showContour) {
                const distToLine = Math.abs(
                    (n * SETTINGS.contourDensity) - Math.round(n * SETTINGS.contourDensity)
                );
                if (distToLine < SETTINGS.contourThreshold) {
                    pixels[idx] = 30;
                    pixels[idx + 1] = 60;
                    pixels[idx + 2] = 110;
                    pixels[idx + 3] = 220;
                    continue;
                }
            }

            pixels[idx] = rgba[0];
            pixels[idx + 1] = rgba[1];
            pixels[idx + 2] = rgba[2];
            pixels[idx + 3] = 255;
        }
    }

    updatePixels();
    drawOverlay();
    updateStatusPanel();
}

function samplePalette(name, value) {
    const stops = palettes[name] ?? palettes.cloud;
    if (stops.length === 0) {
        return [255, 255, 255];
    }

    let chosen;
    if (value <= 0.5) {
        const t = map(value, 0, 0.5, 0, 1);
        chosen = lerpColor(stops[0], stops[1], t);
    } else {
        const t = map(value, 0.5, 1, 0, 1);
        chosen = lerpColor(stops[1], stops[2] ?? stops[1], t);
    }

    return [red(chosen), green(chosen), blue(chosen)];
}

function drawOverlay() {
    resetMatrix();
    noStroke();
    fill(0, 0, 0, 80);
    rect(16, 16, 240, 90, 14);
    fill(255);
    textAlign(LEFT, TOP);
    textSize(13);
    text(
        `noise(x, y, t)\nscale=${SETTINGS.noiseScale.toFixed(3)}  detail=${SETTINGS.detailLevel}\n` +
        `speed=${SETTINGS.timeSpeed.toFixed(3)}  palette=${SETTINGS.palette}`,
        28,
        26
    );
}

function updateStatusPanel() {
    const panel = document.getElementById('status-panel');
    if (!panel) return;

    panel.innerHTML = `
    <p><strong>noiseScale</strong>: ${SETTINGS.noiseScale.toFixed(3)}</p>
    <p><strong>detailLevel</strong>: ${SETTINGS.detailLevel}</p>
    <p><strong>timeSpeed</strong>: ${SETTINGS.timeSpeed.toFixed(3)}</p>
    <p><strong>showContour</strong>: ${SETTINGS.showContour ? 'true' : 'false'}</p>
    <p class="refresh-hint">数値を変えたら保存→リロードで反映されます。</p>
  `;
}

function requestRender() {
    needsRedraw = true;
    redraw();
}

function toggleAnimation() {
    SETTINGS.animate = !SETTINGS.animate;
    if (SETTINGS.animate) {
        loop();
    } else {
        noLoop();
        requestRender();
    }
    updateStatusPanel();
}

function toggleContour() {
    SETTINGS.showContour = !SETTINGS.showContour;
    requestRender();
}

function cyclePalette() {
    const index = PALETTE_ORDER.indexOf(SETTINGS.palette);
    const nextIndex = (index + 1) % PALETTE_ORDER.length;
    SETTINGS.palette = PALETTE_ORDER[nextIndex];
    requestRender();
}

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        toggleAnimation();
    }
    if (event.key === 'c') {
        toggleContour();
    }
    if (event.key === 'p') {
        cyclePalette();
    }
    if (event.key === 's') {
        saveCanvas(`perlin_${SETTINGS.palette}`, 'png');
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

    requestRender();
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
