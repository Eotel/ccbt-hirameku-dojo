const SETTINGS = {
  canvasWidth: 800,
  canvasHeight: 600,
  initialPoints: 12,
  jitterAmount: 0.35,
  colorVariance: 0.28,
  fillOpacity: 210,
  outlineOpacity: 185,
  outlineWeight: 1.6,
  showEdges: true,
  showSeeds: true,
  highlightHover: true,
  useFill: true,
  paletteName: 'giraffe',
  noiseScale: 0.015,
  randomSeed: 2025,
  useOrganicCells: false,
  organicAmount: 28,
  organicNoiseScale: 0.0065,
  organicSegmentLength: 54
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
  ],
  forest: [
    [35, 71, 43],
    [66, 110, 57],
    [120, 163, 81],
    [185, 211, 120],
    [241, 252, 189]
  ],
  candy: [
    [255, 110, 142],
    [255, 180, 162],
    [255, 224, 233],
    [176, 206, 255],
    [135, 181, 255]
  ],
  aurora: [
    [32, 58, 120],
    [54, 126, 166],
    [90, 199, 167],
    [152, 236, 216],
    [245, 234, 167]
  ],
  bubblegum: [
    [240, 128, 209],
    [195, 139, 255],
    [255, 192, 203],
    [255, 227, 150],
    [138, 201, 255]
  ]
};

const PALETTE_META = {
  giraffe: {label: 'きりん模様'},
  desert: {label: '砂漠の夕陽'},
  reef: {label: 'さんご礁'},
  grayscale: {label: 'モノクロ'},
  forest: {label: '森のみどり'},
  candy: {label: 'キャンディ'},
  aurora: {label: 'オーロラ'},
  bubblegum: {label: 'シャーベット'}
};

const PALETTE_ORDER = Object.keys(PALETTES);

let points = [];
let delaunay = null;
let voronoi = null;
let noiseOffset = (SETTINGS.randomSeed ?? Math.random() * 1000) * 0.37;
let hoveredIndex = -1;
let organicNoiseSeed = 0;
let controlElements = {};

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
  organicNoiseSeed = random(0, 10000);

  initPoints(SETTINGS.initialPoints);
  rebuildVoronoi();
  injectControlStyles();
  initControlPanel();
  syncControlPanel();
  noLoop();
  redraw();

  canvas.mouseClicked(() => {
    if (mouseInsideCanvas()) {
      points.push([mouseX, mouseY]);
      rebuildVoronoi();
      redraw();
      updateStatusPanel();
      syncControlPanel();
    }
  });
}

function draw() {
  background(252, 247, 239);
  hoveredIndex = mouseInsideCanvas() && delaunay ? delaunay.find(mouseX, mouseY) : -1;

  if (!voronoi) {
    drawEmptyMessage();
    updateStatusPanel();
    return;
  }

  const palette = getPaletteColors(SETTINGS.paletteName);

  for (let i = 0; i < points.length; i++) {
    const polygon = voronoi.cellPolygon(i);
    if (!polygon || polygon.length === 0) continue;

    const baseColor = palette[i % palette.length];
    const color = computeCellColor(baseColor, points[i], i);
    const isHovered = SETTINGS.highlightHover && i === hoveredIndex;
    const shapePoints = SETTINGS.useOrganicCells ? buildOrganicPolygon(polygon, i) : polygon;

    push();
    if (SETTINGS.useFill) {
      const alpha = isHovered ? Math.min(255, SETTINGS.fillOpacity + 30) : SETTINGS.fillOpacity;
      fill(color[0], color[1], color[2], alpha);
    } else {
      noFill();
    }

    if (SETTINGS.showEdges) {
      const strokeAlpha = isHovered ? Math.min(255, SETTINGS.outlineOpacity + 50) : SETTINGS.outlineOpacity;
      stroke(90, 60, 30, strokeAlpha);
      const extra = isHovered ? 0.6 : 0;
      strokeWeight(SETTINGS.outlineWeight + extra);
    } else {
      noStroke();
    }

    renderPolygonShape(shapePoints, SETTINGS.useOrganicCells);
    pop();
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
  const boxWidth = min(340, width - 36);
  rect(18, height - 120, boxWidth, 102, 12);
  fill(255);
  textAlign(LEFT, TOP);
  textSize(13);
  const paletteLabel = getPaletteLabel(SETTINGS.paletteName);
  const cellMode = SETTINGS.useOrganicCells ? 'Organic' : 'Straight';
  text(
    `点の数: ${points.length} / 目標 ${SETTINGS.initialPoints}\n` +
    `パレット: ${paletteLabel}\n` +
    `塗り: ${SETTINGS.useFill ? 'ON' : 'OFF'} α${Math.round(SETTINGS.fillOpacity)}  ` +
    `線: ${SETTINGS.showEdges ? 'ON' : 'OFF'} 太さ${SETTINGS.outlineWeight.toFixed(1)}\n` +
    `セル形状: ${cellMode}\n` +
    `r: 再配置  c: クリア  s: 保存  p: パレット変更`,
    32,
    height - 110
  );
}

function updateStatusPanel() {
  const panel = document.getElementById('status-panel');
  if (!panel) return;
  const paletteLabel = getPaletteLabel(SETTINGS.paletteName);
  panel.innerHTML = `
  <p><strong>今の点</strong>: ${points.length} / 目標 ${SETTINGS.initialPoints}</p>
  <p><strong>パレット</strong>: ${paletteLabel}</p>
  <p><strong>塗り</strong>: ${SETTINGS.useFill ? 'ON' : 'OFF'} (α ${Math.round(SETTINGS.fillOpacity)})</p>
  <p><strong>境界線</strong>: ${SETTINGS.showEdges ? 'ON' : 'OFF'} / 太さ ${SETTINGS.outlineWeight.toFixed(1)}</p>
  <p><strong>セル形状</strong>: ${SETTINGS.useOrganicCells ? 'Organic' : 'Straight'}</p>
  <p class="refresh-hint">r: 再配置 / c: クリア / s: 保存 / p: パレット変更</p>
 `;
}

function computeCellColor(baseColor, position, index) {
  const jitter = SETTINGS.jitterAmount;
  const sample = noise(
    position[0] * SETTINGS.noiseScale + noiseOffset,
    position[1] * SETTINGS.noiseScale + noiseOffset,
    jitter * 4 + index * 0.21
  );
  const normalized = constrain(sample + jitter * 0.45, 0, 1);
  const variance = SETTINGS.colorVariance;
  const minShade = 1 - variance;
  const maxShade = 1 + variance;
  const shade = lerp(minShade, maxShade, normalized);
  return [
    constrain(baseColor[0] * shade, 0, 255),
    constrain(baseColor[1] * shade, 0, 255),
    constrain(baseColor[2] * shade, 0, 255)
  ];
}

function renderPolygonShape(pointsList, organic) {
  if (!pointsList || pointsList.length === 0) return;
  if (organic) {
    if (pointsList.length < 3) return;
    const total = pointsList.length;
    const first = pointsList[0];
    const second = pointsList[1 % total];
    const last = pointsList[total - 1];
    beginShape();
    curveVertex(last[0], last[1]);
    curveVertex(first[0], first[1]);
    for (const [x, y] of pointsList) {
      curveVertex(x, y);
    }
    curveVertex(first[0], first[1]);
    curveVertex(second[0], second[1]);
    endShape(CLOSE);
  } else {
    beginShape();
    for (const [x, y] of pointsList) {
      vertex(x, y);
    }
    endShape(CLOSE);
  }
}

function buildOrganicPolygon(polygon, index) {
  if (!polygon || polygon.length < 3) {
    return polygon ? [...polygon] : [];
  }

  const organicPoints = [];
  const amount = SETTINGS.organicAmount;
  const scale = SETTINGS.organicNoiseScale;
  const segmentLength = Math.max(12, SETTINGS.organicSegmentLength);

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    organicPoints.push([current[0], current[1]]);

    const dx = next[0] - current[0];
    const dy = next[1] - current[1];
    const edgeLength = Math.sqrt(dx * dx + dy * dy);
    const segments = Math.max(1, Math.round(edgeLength / segmentLength));
    const normalX = edgeLength > 0 ? -dy / edgeLength : 0;
    const normalY = edgeLength > 0 ? dx / edgeLength : 0;

    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      const x = current[0] + dx * t;
      const y = current[1] + dy * t;
      const noiseValue = noise(
        x * scale + organicNoiseSeed,
        y * scale + organicNoiseSeed,
        index * 0.35 + s * 0.18
      );
      const offset = (noiseValue - 0.5) * amount;
      organicPoints.push([x + normalX * offset, y + normalY * offset]);
    }
  }

  return organicPoints;
}

function randomizePoints() {
  if (Number.isFinite(SETTINGS.randomSeed)) {
    randomSeed(SETTINGS.randomSeed + Math.floor(random(1000)));
  }
  initPoints(SETTINGS.initialPoints);
  noiseOffset = random(0, 1000);
  organicNoiseSeed = random(0, 10000);
  rebuildVoronoi();
  redraw();
  updateStatusPanel();
}

function clearPoints() {
  points = [];
  rebuildVoronoi();
  redraw();
  updateStatusPanel();
}

function cyclePalette(direction = 1) {
  const currentIndex = PALETTE_ORDER.indexOf(SETTINGS.paletteName);
  const nextIndex = (currentIndex + direction + PALETTE_ORDER.length) % PALETTE_ORDER.length;
  SETTINGS.paletteName = PALETTE_ORDER[nextIndex];
  redraw();
  updateStatusPanel();
  syncControlPanel();
}

function toggleSetting(key) {
  SETTINGS[key] = !SETTINGS[key];
  redraw();
  updateStatusPanel();
  syncControlPanel();
}

window.addEventListener('keydown', (event) => {
  if (isFormFieldActive(event.target)) {
    return;
  }

  if (event.key === 'r') {
    randomizePoints();
    syncControlPanel();
  }
  if (event.key === 'c') {
    clearPoints();
    syncControlPanel();
  }
  if (event.key === 's') {
    saveCanvas(`voronoi_${points.length}`, 'png');
  }
  if (event.key === 'p') {
    cyclePalette(event.shiftKey ? -1 : 1);
  }
  if (event.key === 'f') {
    toggleSetting('useFill');
  }
  if (event.key === 'l') {
    toggleSetting('showEdges');
  }
  if (event.key === 'o') {
    toggleSetting('useOrganicCells');
  }
  if (event.key === 'h') {
    toggleSetting('highlightHover');
  }
  if (event.key === 'g') {
    toggleSetting('showSeeds');
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

  let widthValue = Math.round(maxUsableWidth);
  let heightValue = Math.round(widthValue / CANVAS_ASPECT_RATIO);

  const safeWindowHeight = Math.max(minHeight, window.innerHeight - marginY);
  let maxUsableHeight = safeWindowHeight;
  if (Number.isFinite(containerHeight) && containerHeight > 0) {
    maxUsableHeight = Math.min(maxUsableHeight, containerHeight);
  }
  maxUsableHeight = Math.max(minHeight, maxUsableHeight);

  if (heightValue > maxUsableHeight) {
    heightValue = Math.round(maxUsableHeight);
    widthValue = Math.round(heightValue * CANVAS_ASPECT_RATIO);
    widthValue = Math.min(widthValue, maxUsableWidth);
  }

  widthValue = Math.max(minWidth, Math.min(widthValue, maxUsableWidth));
  heightValue = Math.max(minHeight, heightValue);

  return {width: widthValue, height: heightValue};
}

function injectControlStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('voronoi-control-style')) return;

  const style = document.createElement('style');
  style.id = 'voronoi-control-style';
  style.textContent = `
  #voronoi-control-panel {
   position: fixed;
   top: 16px;
   right: 16px;
   z-index: 1200;
   width: min(280px, calc(100vw - 32px));
   padding: 18px;
   border-radius: 16px;
   background: rgba(15, 23, 42, 0.85);
   color: #fef3c7;
   font-family: 'Hiragino Sans', 'Meiryo', sans-serif;
   backdrop-filter: blur(8px);
   border: 1px solid rgba(251, 191, 36, 0.3);
   box-shadow: 0 24px 48px rgba(8, 11, 22, 0.45);
  }
  #voronoi-control-panel h3 {
   margin: 0 0 12px;
   font-size: 1.05rem;
   letter-spacing: 0.08em;
  }
  #voronoi-control-panel .section-title {
   margin: 18px 0 10px;
   font-size: 0.85rem;
   letter-spacing: 0.12em;
   text-transform: uppercase;
   color: rgba(252, 211, 77, 0.85);
  }
  #voronoi-control-panel .control-group {
   margin-bottom: 12px;
   display: flex;
   flex-direction: column;
   gap: 6px;
   font-size: 0.85rem;
  }
  #voronoi-control-panel .control-group.disabled {
   opacity: 0.48;
  }
  #voronoi-control-panel label.control-label {
   display: flex;
   align-items: center;
   justify-content: space-between;
   gap: 10px;
   font-size: 0.82rem;
   color: rgba(255, 247, 222, 0.92);
  }
  #voronoi-control-panel label.control-label span {
   flex: 1;
  }
  #voronoi-control-panel label.control-label .value {
   font-variant-numeric: tabular-nums;
   color: rgba(255, 255, 255, 0.75);
   min-width: 48px;
   text-align: right;
  }
  #voronoi-control-panel select,
  #voronoi-control-panel input[type="range"],
  #voronoi-control-panel button {
   font-family: inherit;
  }
  #voronoi-control-panel select {
   width: 100%;
   padding: 6px 8px;
   border-radius: 10px;
   border: 1px solid rgba(148, 163, 184, 0.4);
   background: rgba(17, 24, 39, 0.8);
   color: #fef3c7;
  }
  #voronoi-control-panel input[type="range"] {
   width: 100%;
   accent-color: #fbbf24;
  }
  #voronoi-control-panel .toggle {
   display: flex;
   align-items: center;
   gap: 8px;
   font-size: 0.85rem;
   color: rgba(254, 243, 199, 0.9);
  }
  #voronoi-control-panel .toggle input {
   margin: 0;
  }
  #voronoi-control-panel .palette-preview {
   display: grid;
   grid-auto-flow: column;
   gap: 4px;
   border-radius: 10px;
   overflow: hidden;
   border: 1px solid rgba(148, 163, 184, 0.4);
   height: 16px;
  }
  #voronoi-control-panel .palette-preview span {
   height: 100%;
  }
  #voronoi-control-panel .button-row {
   display: flex;
   flex-wrap: wrap;
   gap: 8px;
   margin-top: 12px;
  }
  #voronoi-control-panel .button-row button {
   flex: 1 1 120px;
   padding: 6px 10px;
   border-radius: 10px;
   background: rgba(251, 191, 36, 0.22);
   border: 1px solid rgba(251, 191, 36, 0.35);
   color: #fef3c7;
   font-weight: 600;
   cursor: pointer;
   transition: background 0.2s ease;
  }
  #voronoi-control-panel .button-row button:hover,
  #voronoi-control-panel .button-row button:focus {
   background: rgba(251, 191, 36, 0.32);
   outline: none;
  }
  @media (max-width: 720px) {
   #voronoi-control-panel {
    position: static;
    margin: 16px;
    width: calc(100% - 32px);
   }
  }
 `;
  document.head.appendChild(style);
}

function initControlPanel() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('voronoi-control-panel')) {
    controlElements.panel = document.getElementById('voronoi-control-panel');
    return;
  }

  const panel = document.createElement('section');
  panel.id = 'voronoi-control-panel';
  const heading = document.createElement('h3');
  heading.textContent = '色とスタイルを遊ぼう';
  panel.appendChild(heading);

  addSectionTitle(panel, 'PALETTE');
  controlElements.paletteSelect = addSelectControl(panel, getPaletteColors, (value) => {
    SETTINGS.paletteName = value;
    redraw();
    updateStatusPanel();
    updatePalettePreview();
  });
  controlElements.palettePreview = addPalettePreview(panel);
  updatePalettePreview();

  controlElements.useFill = addCheckboxControl(panel, '塗りつぶしを表示', SETTINGS.useFill, (checked) => {
    SETTINGS.useFill = checked;
    redraw();
    updateStatusPanel();
  });

  controlElements.fillOpacity = addSliderControl(panel, {
    label: '塗りの透明度',
    min: 40,
    max: 255,
    step: 1,
    value: SETTINGS.fillOpacity,
    format: (value) => `${Math.round((value / 255) * 100)}%`,
    onChange: (value) => {
      SETTINGS.fillOpacity = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.jitterAmount = addSliderControl(panel, {
    label: '色のゆらぎ',
    min: 0,
    max: 0.7,
    step: 0.01,
    value: SETTINGS.jitterAmount,
    format: (value) => value.toFixed(2),
    onChange: (value) => {
      SETTINGS.jitterAmount = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.colorVariance = addSliderControl(panel, {
    label: '明るさレンジ',
    min: 0.1,
    max: 0.8,
    step: 0.01,
    value: SETTINGS.colorVariance,
    format: (value) => `±${Math.round(value * 100)}%`,
    onChange: (value) => {
      SETTINGS.colorVariance = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.noiseScale = addSliderControl(panel, {
    label: '模様の細かさ',
    min: 0.005,
    max: 0.04,
    step: 0.001,
    value: SETTINGS.noiseScale,
    format: (value) => value.toFixed(3),
    onChange: (value) => {
      SETTINGS.noiseScale = value;
      redraw();
      updateStatusPanel();
    }
  });

  addSectionTitle(panel, 'LINES & CELLS');

  controlElements.showEdges = addCheckboxControl(panel, '境界線を表示', SETTINGS.showEdges, (checked) => {
    SETTINGS.showEdges = checked;
    redraw();
    updateStatusPanel();
  });

  controlElements.outlineWeight = addSliderControl(panel, {
    label: '線の太さ',
    min: 0.4,
    max: 4,
    step: 0.1,
    value: SETTINGS.outlineWeight,
    format: (value) => value.toFixed(1),
    onChange: (value) => {
      SETTINGS.outlineWeight = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.outlineOpacity = addSliderControl(panel, {
    label: '線の濃さ',
    min: 30,
    max: 255,
    step: 1,
    value: SETTINGS.outlineOpacity,
    format: (value) => `${Math.round((value / 255) * 100)}%`,
    onChange: (value) => {
      SETTINGS.outlineOpacity = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.useOrganicCells = addCheckboxControl(panel, '細胞っぽくする', SETTINGS.useOrganicCells, (checked) => {
    SETTINGS.useOrganicCells = checked;
    updateOrganicControlDisabledState();
    redraw();
    updateStatusPanel();
  });

  controlElements.organicAmount = addSliderControl(panel, {
    label: '細胞のゆらぎ',
    min: 0,
    max: 70,
    step: 1,
    value: SETTINGS.organicAmount,
    format: (value) => `${Math.round(value)}px`,
    onChange: (value) => {
      SETTINGS.organicAmount = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.organicNoiseScale = addSliderControl(panel, {
    label: 'ゆらぎの細かさ',
    min: 0.003,
    max: 0.02,
    step: 0.001,
    value: SETTINGS.organicNoiseScale,
    format: (value) => value.toFixed(3),
    onChange: (value) => {
      SETTINGS.organicNoiseScale = value;
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.pointCount = addSliderControl(panel, {
    label: '初期の点の数',
    min: 4,
    max: 45,
    step: 1,
    value: SETTINGS.initialPoints,
    format: (value) => Math.round(value),
    onChange: (value) => {
      SETTINGS.initialPoints = Math.round(value);
      initPoints(SETTINGS.initialPoints);
      rebuildVoronoi();
      redraw();
      updateStatusPanel();
    }
  });

  controlElements.showSeeds = addCheckboxControl(panel, '点を表示', SETTINGS.showSeeds, (checked) => {
    SETTINGS.showSeeds = checked;
    redraw();
    updateStatusPanel();
  });

  controlElements.highlightHover = addCheckboxControl(panel, 'ホバーでハイライト', SETTINGS.highlightHover, (checked) => {
    SETTINGS.highlightHover = checked;
    redraw();
    updateStatusPanel();
  });

  addSectionTitle(panel, 'ACTIONS');
  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';
  buttonRow.appendChild(addButton('点をランダムに並べる', () => {
    randomizePoints();
    syncControlPanel();
  }));
  buttonRow.appendChild(addButton('点を全部消す', () => {
    clearPoints();
    syncControlPanel();
  }));
  buttonRow.appendChild(addButton('パレットをシャッフル', () => {
    cyclePalette(1);
  }));
  panel.appendChild(buttonRow);

  document.body.appendChild(panel);
  controlElements.panel = panel;
  updateOrganicControlDisabledState();
}

function addSectionTitle(panel, text) {
  const title = document.createElement('p');
  title.className = 'section-title';
  title.textContent = text;
  panel.appendChild(title);
}

function addSelectControl(panel, paletteProvider, onChange) {
  const group = document.createElement('div');
  group.className = 'control-group';
  const label = document.createElement('label');
  label.className = 'control-label';
  const labelText = document.createElement('span');
  labelText.textContent = 'カラーパレット';
  label.appendChild(labelText);
  group.appendChild(label);

  const select = document.createElement('select');
  for (const key of PALETTE_ORDER) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = getPaletteLabel(key);
    select.appendChild(option);
  }
  select.value = SETTINGS.paletteName;
  select.addEventListener('change', () => {
    onChange(select.value, paletteProvider(select.value));
  });
  group.appendChild(select);
  panel.appendChild(group);
  return select;
}

function addPalettePreview(panel) {
  const preview = document.createElement('div');
  preview.className = 'palette-preview';
  panel.appendChild(preview);
  return preview;
}

function addCheckboxControl(panel, text, initialValue, onChange) {
  const wrapper = document.createElement('label');
  wrapper.className = 'toggle';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = initialValue;
  input.addEventListener('change', () => onChange(input.checked));
  wrapper.appendChild(input);
  const span = document.createElement('span');
  span.textContent = text;
  wrapper.appendChild(span);
  panel.appendChild(wrapper);
  return input;
}

function addSliderControl(panel, {label, min, max, step, value, format, onChange}) {
  const group = document.createElement('div');
  group.className = 'control-group';
  const labelEl = document.createElement('label');
  labelEl.className = 'control-label';
  const span = document.createElement('span');
  span.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = format(value);
  labelEl.appendChild(span);
  labelEl.appendChild(valueEl);
  group.appendChild(labelEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.addEventListener('input', () => {
    const currentValue = parseFloat(input.value);
    valueEl.textContent = format(currentValue);
    onChange(currentValue);
  });
  group.appendChild(input);
  panel.appendChild(group);
  return {input, valueEl, format, group};
}

function addButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function updatePalettePreview() {
  if (!controlElements.palettePreview) return;
  const palette = getPaletteColors(SETTINGS.paletteName);
  controlElements.palettePreview.innerHTML = '';
  for (const color of palette) {
    const swatch = document.createElement('span');
    swatch.style.background = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    controlElements.palettePreview.appendChild(swatch);
  }
}

function updateOrganicControlDisabledState() {
  const disabled = !SETTINGS.useOrganicCells;
  toggleSlider(controlElements.organicAmount, disabled);
  toggleSlider(controlElements.organicNoiseScale, disabled);
}

function toggleSlider(control, disabled) {
  if (!control) return;
  control.input.disabled = disabled;
  if (control.group) {
    control.group.classList.toggle('disabled', disabled);
  }
}

function syncControlPanel() {
  if (!controlElements.panel) return;

  if (controlElements.paletteSelect) {
    controlElements.paletteSelect.value = SETTINGS.paletteName;
    updatePalettePreview();
  }
  if (controlElements.useFill) {
    controlElements.useFill.checked = SETTINGS.useFill;
  }
  setSliderValue(controlElements.fillOpacity, SETTINGS.fillOpacity);
  setSliderValue(controlElements.jitterAmount, SETTINGS.jitterAmount);
  setSliderValue(controlElements.colorVariance, SETTINGS.colorVariance);
  setSliderValue(controlElements.noiseScale, SETTINGS.noiseScale);
  if (controlElements.showEdges) {
    controlElements.showEdges.checked = SETTINGS.showEdges;
  }
  setSliderValue(controlElements.outlineWeight, SETTINGS.outlineWeight);
  setSliderValue(controlElements.outlineOpacity, SETTINGS.outlineOpacity);
  if (controlElements.useOrganicCells) {
    controlElements.useOrganicCells.checked = SETTINGS.useOrganicCells;
  }
  setSliderValue(controlElements.organicAmount, SETTINGS.organicAmount);
  setSliderValue(controlElements.organicNoiseScale, SETTINGS.organicNoiseScale);
  setSliderValue(controlElements.pointCount, SETTINGS.initialPoints);
  if (controlElements.showSeeds) {
    controlElements.showSeeds.checked = SETTINGS.showSeeds;
  }
  if (controlElements.highlightHover) {
    controlElements.highlightHover.checked = SETTINGS.highlightHover;
  }
  updateOrganicControlDisabledState();
}

function setSliderValue(control, value) {
  if (!control) return;
  control.input.value = value;
  if (control.valueEl) {
    control.valueEl.textContent = control.format(parseFloat(value));
  }
}

function getPaletteLabel(name) {
  return PALETTE_META[name]?.label ?? name;
}

function getPaletteColors(name) {
  return PALETTES[name] ?? PALETTES.giraffe;
}

function isFormFieldActive(el) {
  if (!el) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
}
