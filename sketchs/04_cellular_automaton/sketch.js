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

    // 初期プリセットを適用
    engine.applyPreset(config.DEFAULT_PRESET_KEY, {skipRegenerate: true, silent: true});

    function setup() {
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

        maxGenerations = Math.floor(height / engine.settings.cellSize);
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

            for (let i = 0; i < row.length; i++) {
                if (row[i] === 1) {
                    const x = i * cellSize;
                    fill(getCellColor(settings, gen, generationsToShow));
                    rect(x, y, cellSize, cellSize);
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

            if (colorData.mode === 'hsb') {
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
        const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
        const containerHeight = typeof window !== 'undefined' ? window.innerHeight : 600;
        const aspectRatio = engine.aspectRatio || (4 / 3);

        let width = Math.min(containerWidth - 40, 1200);
        let height = Math.floor(width / aspectRatio);

        if (height > containerHeight - 100) {
            height = containerHeight - 100;
            width = Math.floor(height * aspectRatio);
        }

        return {width, height};
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

    function announceAppReady() {
        const context = {
            engine,
            redraw: () => {
                const {width, height} = computeCanvasSize();
                engine.settings.canvasWidth = width;
                engine.settings.canvasHeight = height;
                resizeCanvas(width, height);
                updateCanvasShellHeight(height);
                maxGenerations = Math.floor(height / engine.settings.cellSize);
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
