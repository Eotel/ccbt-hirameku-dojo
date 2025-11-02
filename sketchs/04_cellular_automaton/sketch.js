(() => {
    const utils = window.Utils;
    const config = window.CellularAutomatonConfig;
    const engineFactory = window.CellularAutomatonEngine;
    const guiFactory = window.CellularAutomatonGui;

    if (!utils) {
        throw new Error('Utils が読み込まれていません。先に ../common/utils.js を含めてください。');
    }
    if (!config) {
        throw new Error('CellularAutomatonConfig が読み込まれていません。config.js を先に読み込んでください。');
    }
    if (!engineFactory || typeof engineFactory.create !== 'function') {
        throw new Error('CellularAutomatonEngine が初期化されていません。engine.js を読み込んでください。');
    }

    const {
        attachCanvas: attachCanvasToContainer,
        updateStatusPanel: applyStatusPanelContent,
        registerKeyboardShortcuts,
        saveCanvasWithTimestamp
    } = utils;

    const engine = engineFactory.create({config, utils});
    const guiManager = guiFactory && typeof guiFactory.create === 'function' ? guiFactory.create() : null;
    let appContext = null;

    let isAnimating = false;
    let lastGenerationTime = 0;
    let maxGenerations = 0;
    let shapeKit = null;
    let customCellDrawer = null;

    // 初期プリセットを適用
    engine.applyPreset(config.DEFAULT_PRESET_KEY, {skipRegenerate: true, silent: true});

    function setup() {
        ensureInlineScaffolding();

        const {width, height} = computeCanvasSize();
        engine.settings.canvasWidth = width;
        engine.settings.canvasHeight = height;

        const canvas = createCanvas(width, height);
        if (typeof attachCanvasToContainer === 'function') {
            attachCanvasToContainer(canvas, 'canvas-container');
        } else {
            canvas.parent(document.body);
        }

        updateCanvasShellHeight(height);
        colorMode(HSB, 360, 100, 100);
        noStroke();
        ellipseMode(CENTER);
        rectMode(CORNER);

        ensureShapeKit();

        maxGenerations = Math.max(1, Math.floor(height / engine.settings.cellSize));
        engine.regenerate({silent: true});

        appContext = announceAppReady();
        if (guiManager && typeof guiManager.maybeAttachInlineGui === 'function') {
            guiManager.maybeAttachInlineGui(appContext);
        }

        attachShortcuts();
    }

    function draw() {
        const settings = engine.settings;
        const grid = engine.getGrid();

        // 背景
        const bg = settings.backgroundColor || [245, 248, 252];
        background(bg[0] ?? 245, bg[1] ?? 248, bg[2] ?? 252);

        // グリッドを描画
        const cellSize = settings.cellSize;
        const generationsToShow = Math.min(grid.length, maxGenerations);

        for (let gen = 0; gen < generationsToShow; gen++) {
            const row = grid[gen];
            const y = gen * cellSize;
            const fillColor = getCellColor(settings, gen, generationsToShow);

            for (let i = 0; i < row.length; i++) {
                if (row[i] === 1) {
                    const x = i * cellSize;
                    drawCellShape({
                        shape: settings.cellShape,
                        x,
                        y,
                        size: cellSize,
                        generation: gen,
                        column: i,
                        fillColor,
                        settings,
                        totalGenerations: generationsToShow,
                        gridWidth: row.length,
                        value: row[i]
                    });
                }
            }
        }

        // アニメーション処理
        if (isAnimating && grid.length < maxGenerations) {
            const now = millis();
            const interval = 1000 / settings.animationSpeed;

            if (now - lastGenerationTime >= interval) {
                engine.stepGeneration({silent: true});
                lastGenerationTime = now;
                updateStatus();
            }
        } else if (isAnimating && grid.length >= maxGenerations) {
            isAnimating = false;
        }
    }

    function getCellColor(settings, generation, maxGen) {
        const schemeName = settings.colorScheme || 'classic';
        const schemes = config.COLOR_SCHEMES || {};
        const scheme = schemes[schemeName];

        // カラースキーム定義が存在する場合は、それを使用
        if (scheme && typeof scheme.compute === 'function') {
            const colorData = scheme.compute(generation, maxGen, settings);

            if (colorData.hex) {
                // HEX モード (16進数カラーコード)
                return color(colorData.hex);
            } else if (colorData.mode === 'hsb') {
                // HSB モード
                return color(colorData.h, colorData.s, colorData.b);
            } else {
                // RGB モード (デフォルト)
                return color(colorData.r, colorData.g, colorData.b);
            }
        }

        // フォールバック: カラースキームが見つからない場合は固定色を使用
        const cellColor = settings.cellColor || [30, 41, 59];
        return color(cellColor[0], cellColor[1], cellColor[2]);
    }

    function computeCanvasSize() {
        if (typeof window === 'undefined') {
            const fallbackWidth = engine?.settings?.canvasWidth ?? 800;
            const fallbackHeight = engine?.settings?.canvasHeight ?? 600;
            return {width: fallbackWidth, height: fallbackHeight};
        }

        const padding = getBodyPaddingTotals();
        const cellSize = Math.max(1, engine?.settings?.cellSize ?? 4);

        const availableWidth = Math.max(cellSize, Math.floor(window.innerWidth - padding.horizontal));
        const availableHeight = Math.max(cellSize, Math.floor(window.innerHeight - padding.vertical));

        return {
            width: availableWidth,
            height: availableHeight
        };
    }

    function getBodyPaddingTotals() {
        if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function' || !document?.body) {
            return {horizontal: 0, vertical: 0};
        }

        const style = window.getComputedStyle(document.body);
        const parse = (value) => {
            const result = parseFloat(value);
            return Number.isFinite(result) ? result : 0;
        };

        return {
            horizontal: parse(style.paddingLeft) + parse(style.paddingRight),
            vertical: parse(style.paddingTop) + parse(style.paddingBottom)
        };
    }

    function updateCanvasShellHeight(height) {
        if (typeof document === 'undefined') {
            return;
        }
        const shell = document.getElementById('canvas-shell');
        if (shell) {
            shell.style.height = `${height}px`;
        }
    }

    function ensureInlineScaffolding() {
        if (typeof document === 'undefined') {
            return;
        }

        const body = document.body;
        if (!body) {
            return;
        }

        let container = document.getElementById('canvas-container');
        const createdContainer = !container;
        if (createdContainer) {
            container = document.createElement('div');
            container.id = 'canvas-container';
            container.style.position = 'relative';
            container.style.width = '100%';
            container.style.maxWidth = '100%';
            container.style.margin = '0 auto';
            container.style.padding = '0';
            container.style.display = 'flex';
            container.style.justifyContent = 'center';
            container.style.alignItems = 'center';
            container.style.background = 'rgba(15, 23, 42, 0.6)';
            container.style.borderRadius = '12px';
            container.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
            container.style.boxSizing = 'border-box';
            body.insertBefore(container, body.firstChild);

            body.style.margin = body.style.margin || '0';
            body.style.overflowX = body.style.overflowX || 'hidden';
            body.style.minHeight = body.style.minHeight || '100vh';
            body.style.fontFamily = body.style.fontFamily || "'Hiragino Sans', 'Meiryo', sans-serif";
            if (!body.style.background) {
                body.style.background = '#0f172a';
            }
        }

        let shell = document.getElementById('canvas-shell');
        if (!shell && container) {
            shell = document.createElement('div');
            shell.id = 'canvas-shell';
            shell.style.width = '100%';
            shell.style.display = 'flex';
            shell.style.justifyContent = 'center';
            shell.style.alignItems = 'center';
            container.appendChild(shell);
        }

        let guiContainer = document.getElementById('gui-container');
        if (!guiContainer) {
            guiContainer = document.createElement('div');
            guiContainer.id = 'gui-container';
            guiContainer.style.position = 'fixed';
            guiContainer.style.top = '16px';
            guiContainer.style.right = '16px';
            guiContainer.style.zIndex = '1000';
            guiContainer.style.maxWidth = '320px';
            body.appendChild(guiContainer);
        }

        let statusPanel = document.getElementById('status-panel');
        if (!statusPanel) {
            statusPanel = document.createElement('div');
            statusPanel.id = 'status-panel';
            statusPanel.style.position = 'fixed';
            statusPanel.style.bottom = '16px';
            statusPanel.style.left = '16px';
            statusPanel.style.background = 'rgba(30, 41, 59, 0.95)';
            statusPanel.style.border = '1px solid rgba(148, 163, 184, 0.3)';
            statusPanel.style.borderRadius = '10px';
            statusPanel.style.padding = '16px 20px';
            statusPanel.style.fontFamily = "'Monaco', 'Menlo', monospace";
            statusPanel.style.fontSize = '13px';
            statusPanel.style.lineHeight = '1.6';
            statusPanel.style.color = '#cbd5e1';
            statusPanel.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            statusPanel.style.whiteSpace = 'pre-line';
            statusPanel.style.maxWidth = '400px';
            statusPanel.style.boxSizing = 'border-box';
            body.appendChild(statusPanel);
        }
    }

    function announceAppReady() {
        const context = {
            engine,
            redraw: () => {
                const {width, height} = computeCanvasSize();
                engine.settings.canvasWidth = width;
                engine.settings.canvasHeight = height;
                ensureGridMatchesCanvasWidth(width);
                resizeCanvas(width, height);
                updateCanvasShellHeight(height);
                maxGenerations = Math.max(1, Math.floor(height / engine.settings.cellSize));
                redraw();
                updateStatus();
            }
        };

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ca-ready', {detail: context}));
        }

        updateStatus();
        return context;
    }

    function updateStatus() {
        if (typeof applyStatusPanelContent !== 'function') {
            return;
        }

        const stats = engine.getStats();
        const settings = engine.settings;

        const lines = [
            `ルール: ${settings.rule} (${engine.getRuleBinary()})`,
            `世代: ${stats.generation}`,
            `生存セル: ${stats.aliveCells} / ${stats.totalCells}`,
            `状態: ${isAnimating ? '▶️ 実行中' : '⏸️ 停止'}`
        ];

        applyStatusPanelContent(lines.join('\n'));
    }

    function ensureShapeKit() {
        if (!shapeKit && typeof Shapes !== 'undefined' && Shapes && typeof Shapes.create === 'function') {
            shapeKit = Shapes.create();
        }
        return shapeKit;
    }

    function ensureGridMatchesCanvasWidth(canvasWidth) {
        const cellSize = Math.max(1, engine.settings?.cellSize ?? 4);
        const expectedColumns = Math.max(1, Math.floor(canvasWidth / cellSize));
        const grid = engine.getGrid();
        const currentColumns = Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])
            ? grid[0].length
            : 0;

        if (currentColumns !== expectedColumns) {
            engine.regenerate({silent: true});
        }
    }

    function drawCellShape(payload) {
        ensureShapeKit();

        const rawShape = payload?.shape ?? 'square';
        const shapeOptions = (rawShape && typeof rawShape === 'object' && !Array.isArray(rawShape))
            ? {...rawShape}
            : {};
        const shapeName = typeof rawShape === 'string'
            ? rawShape
            : (shapeOptions.type || shapeOptions.use || shapeOptions.name || 'square');

        const size = payload?.size ?? engine.settings.cellSize ?? 4;
        const x = payload?.x ?? 0;
        const y = payload?.y ?? 0;
        const fillColor = payload?.fillColor;
        const generation = payload?.generation ?? 0;
        const column = payload?.column ?? 0;
        const totalGenerations = payload?.totalGenerations ?? maxGenerations;
        const gridWidth = payload?.gridWidth;
        const value = payload?.value ?? 1;
        const settings = payload?.settings || engine.settings;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        const context = {
            shape: rawShape,
            shapeName,
            shapeOptions,
            x,
            y,
            centerX,
            centerY,
            size,
            fillColor,
            color: fillColor,
            cellSize: size,
            generation,
            row: generation,
            column,
            value,
            totalGenerations,
            gridWidth,
            settings,
            engine,
            shapeKit,
            p: window,
            drawDefault: () => defaultCellRenderer(context)
        };

        let skipDefault = false;

        if (typeof rawShape === 'function') {
            const result = rawShape(context);
            skipDefault = result === true || (result && result.skipDefault === true);
        }

        if (!skipDefault && typeof customCellDrawer === 'function') {
            const result = customCellDrawer(context);
            skipDefault = result === true || (result && result.skipDefault === true);
        }

        if (skipDefault) {
            return;
        }

        defaultCellRenderer(context);
    }

    function defaultCellRenderer(context) {
        const options = context.shapeOptions || {};
        const rawName = context.shapeName;
        const normalized = typeof rawName === 'string' ? rawName.toLowerCase() : 'square';
        const size = context.size ?? engine.settings.cellSize ?? 4;
        const x = context.x ?? 0;
        const y = context.y ?? 0;
        const centerX = context.centerX ?? (x + size / 2);
        const centerY = context.centerY ?? (y + size / 2);
        const baseFill = options.fill !== undefined ? options.fill : context.fillColor;
        const rotation = options.rotation ?? 0;

        const polygonNameMatch = typeof normalized === 'string' ? normalized.match(/^polygon[-_:]?(\d{1,2})$/) : null;
        const namedPolygonSides = {
            hexagon: 6,
            pentagon: 5,
            octagon: 8,
            heptagon: 7
        };

        const resolvePolygonSides = () => {
            if (polygonNameMatch) {
                return Math.max(3, parseInt(polygonNameMatch[1], 10));
            }
            if (namedPolygonSides[normalized] !== undefined) {
                return namedPolygonSides[normalized];
            }
            if (options.sides !== undefined) {
                return Math.max(3, Math.round(options.sides));
            }
            if (options.vertices !== undefined) {
                return Math.max(3, Math.round(options.vertices));
            }
            return null;
        };

        if (shapeKit) {
            const baseOptions = {
                x: centerX,
                y: centerY,
                fill: baseFill,
                stroke: options.stroke === undefined ? null : options.stroke,
                strokeWeight: options.strokeWeight,
                rotation,
                scale: options.scale
            };
            const diameter = options.diameter ?? options.size ?? size;

            switch (normalized) {
                case 'square':
                case 'rect':
                case 'rectangle':
                    shapeKit.square({
                        ...baseOptions,
                        size: options.size ?? size,
                        radius: options.radius ?? options.cornerRadius ?? 0
                    });
                    return;
                case 'circle':
                case 'ellipse':
                    shapeKit.circle({
                        ...baseOptions,
                        diameter
                    });
                    return;
                case 'diamond':
                    shapeKit.diamond({
                        ...baseOptions,
                        diameter,
                        aspectRatio: options.aspectRatio ?? 1
                    });
                    return;
                case 'triangle':
                    shapeKit.triangle({
                        ...baseOptions,
                        diameter,
                        offsetAngle: options.offsetAngle ?? options.offset ?? -HALF_PI
                    });
                    return;
                case 'star':
                    shapeKit.star({
                        ...baseOptions,
                        diameter,
                        spikes: Math.max(3, Math.round(options.spikes ?? 5)),
                        innerScale: options.innerScale ?? 0.5
                    });
                    return;
                case 'polygon': {
                    const sides = resolvePolygonSides() ?? 6;
                    shapeKit.polygon({
                        ...baseOptions,
                        diameter,
                        sides
                    });
                    return;
                }
                default: {
                    if (polygonNameMatch || namedPolygonSides[normalized] !== undefined) {
                        const sides = resolvePolygonSides() ?? 6;
                        shapeKit.polygon({
                            ...baseOptions,
                            diameter,
                            sides
                        });
                        return;
                    }
                }
            }
        }

        if (options.stroke !== undefined) {
            if (options.stroke === false || options.stroke === null) {
                noStroke();
            } else if (Array.isArray(options.stroke)) {
                stroke(...options.stroke);
                if (options.strokeWeight !== undefined) {
                    strokeWeight(options.strokeWeight);
                }
            } else {
                stroke(options.stroke);
                if (options.strokeWeight !== undefined) {
                    strokeWeight(options.strokeWeight);
                }
            }
        } else {
            noStroke();
        }

        if (baseFill !== undefined) {
            if (Array.isArray(baseFill)) {
                fill(...baseFill);
            } else {
                fill(baseFill);
            }
        } else if (context.fillColor !== undefined) {
            fill(context.fillColor);
        }

        switch (normalized) {
            case 'circle':
            case 'ellipse':
                circle(centerX, centerY, size);
                break;
            case 'diamond':
                push();
                translate(centerX, centerY);
                rotate(PI / 4 + rotation);
                rect(-size / 2, -size / 2, size, size);
                pop();
                break;
            case 'triangle': {
                push();
                translate(centerX, centerY);
                rotate(rotation);
                const radius = size / 2;
                beginShape();
                for (let i = 0; i < 3; i++) {
                    const angle = -HALF_PI + (TWO_PI * i) / 3;
                    vertex(radius * Math.cos(angle), radius * Math.sin(angle));
                }
                endShape(CLOSE);
                pop();
                break;
            }
            case 'star': {
                push();
                translate(centerX, centerY);
                rotate(rotation);
                const spikes = Math.max(3, Math.round(options.spikes ?? 5));
                const outerRadius = size / 2;
                const innerRadius = outerRadius * (options.innerScale ?? 0.5);
                beginShape();
                for (let i = 0; i < spikes * 2; i++) {
                    const radius = i % 2 === 0 ? outerRadius : innerRadius;
                    const angle = (Math.PI * i) / spikes;
                    vertex(radius * Math.cos(angle), radius * Math.sin(angle));
                }
                endShape(CLOSE);
                pop();
                break;
            }
            case 'polygon':
            default: {
                const sides = resolvePolygonSides();
                if (sides && sides >= 3) {
                    const radius = size / 2;
                    push();
                    translate(centerX, centerY);
                    rotate(rotation);
                    beginShape();
                    for (let i = 0; i < sides; i++) {
                        const angle = (TWO_PI * i) / sides;
                        vertex(radius * Math.cos(angle), radius * Math.sin(angle));
                    }
                    endShape(CLOSE);
                    pop();
                } else {
                    rect(x, y, size, size);
                }
                break;
            }
        }
    }

    function requestImmediateRedraw() {
        if (appContext && typeof appContext.redraw === 'function') {
            appContext.redraw();
        } else if (typeof window !== 'undefined' && typeof window.redraw === 'function') {
            window.redraw();
        }
    }

    if (typeof window !== 'undefined') {
        window.CellularAutomatonDrawing = {
            /**
             * 上級者向け: 独自のセル描画ロジックを登録できます。
             * 例)
             * window.CellularAutomatonDrawing.use(({shapeKit, centerX, centerY, size, fillColor, drawDefault}) => {
             *     if (!shapeKit) return false; // そのまま既定描画
             *     shapeKit.star({ x: centerX, y: centerY, diameter: size * 1.1, fill: fillColor, spikes: 6 });
             *     return true; // 既定描画をスキップ
             * });
             */
            use(drawer) {
                customCellDrawer = typeof drawer === 'function' ? drawer : null;
                requestImmediateRedraw();
                return customCellDrawer;
            },
            reset() {
                customCellDrawer = null;
                requestImmediateRedraw();
            },
            getShapeKit() {
                return ensureShapeKit();
            },
            getDefaultDrawer() {
                return defaultCellRenderer;
            },
            getEngine() {
                return engine;
            }
        };
    }

    function attachShortcuts() {
        if (typeof registerKeyboardShortcuts !== 'function') {
            return;
        }

        registerKeyboardShortcuts([
            {
                key: ' ',
                handler: () => {
                    toggleAnimation();
                }
            },
            {
                key: 'r',
                handler: () => {
                    engine.regenerate();
                    redraw();
                    updateStatus();
                }
            },
            {
                key: 'n',
                handler: () => {
                    if (engine.getGrid().length < maxGenerations) {
                        engine.stepGeneration({silent: true});
                        redraw();
                        updateStatus();
                    }
                }
            },
            {
                key: 's',
                handler: () => {
                    if (typeof saveCanvasWithTimestamp === 'function') {
                        saveCanvasWithTimestamp(`ca-rule${engine.settings.rule}`);
                    }
                }
            },
            {
                key: 'h',
                handler: () => {
                    if (guiManager && typeof guiManager.toggleVisibility === 'function') {
                        guiManager.toggleVisibility();
                    }
                }
            }
        ]);
    }

    function toggleAnimation() {
        isAnimating = !isAnimating;
        if (isAnimating) {
            lastGenerationTime = millis();
            loop();
        } else {
            noLoop();
        }
        updateStatus();
    }

    // p5.js グローバル関数
    window.setup = setup;
    window.draw = draw;

    window.windowResized = () => {
        if (appContext && typeof appContext.redraw === 'function') {
            appContext.redraw();
        }
    };
})();
