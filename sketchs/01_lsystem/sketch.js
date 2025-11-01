(() => {
    const utils = window.Utils;
    const config = window.LSystemConfig;
    const engineFactory = window.LSystemEngine;
    const guiFactory = window.LSystemGui;

    if (!utils) {
        throw new Error('Utils が読み込まれていません。先に ../common/utils.js を含めてください。');
    }
    if (!config) {
        throw new Error('LSystemConfig が読み込まれていません。config.js を先に読み込んでください。');
    }
    if (!engineFactory || typeof engineFactory.create !== 'function') {
        throw new Error('LSystemEngine が初期化されていません。engine.js を読み込んでください。');
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

    const DRAW_COMMANDS = new Set(['F', 'A', 'B', 'G']);
    const renderCache = {
        commands: [],
        drawSegments: [],
        branchCount: 0,
        bounds: null
    };

    const playbackState = {
        mode: 'static',
        playing: false,
        stepIndex: 0,
        speed: 360,
        lastFrameMillis: null
    };

    const displayOptions = {
        showTurtleIndicator: false
    };

    // 初期プリセットを適用（描画は setup 内で行う）
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
        angleMode(DEGREES);
        noLoop();

        regenerateTree({silent: true});

        appContext = announceAppReady();
        if (guiManager && typeof guiManager.maybeAttachInlineGui === 'function') {
            guiManager.maybeAttachInlineGui(appContext);
        }

        attachShortcuts();
    }

    function draw() {
        const settings = engine.settings;
        const bg = settings.backgroundColor || [240, 248, 255];
        background(bg[0] ?? 240, bg[1] ?? 248, bg[2] ?? 255);

        push();
        const origin = settings.origin || {x: 0.5, y: 0.92};
        translate(width * origin.x, height * origin.y);
        rotate(settings.initialRotation || 0);

        const executedCount = playbackState.mode === 'step'
            ? Math.floor(clampStepIndex(playbackState.stepIndex))
            : renderCache.commands.length;

        const highlightIndex =
            playbackState.mode === 'step' && executedCount > 0
                ? Math.min(executedCount - 1, renderCache.commands.length - 1)
                : null;

        drawSegmentsUpTo(executedCount, highlightIndex);

        if (displayOptions.showTurtleIndicator) {
            const turtleState = getTurtleIndicatorState(executedCount);
            if (turtleState) {
                drawTurtleIndicator(turtleState);
            }
        }

        if (playbackState.mode === 'step') {
            if (playbackState.playing) {
                advancePlayback();
            }
        }

        pop();

        renderStatusPanel();
    }

    function drawSegmentsUpTo(limit, highlightIndex = null) {
        if (!Array.isArray(renderCache.drawSegments)) {
            return;
        }

        let highlightCommandIndex = null;
        if (highlightIndex !== null) {
            for (let i = renderCache.drawSegments.length - 1; i >= 0; i--) {
                const candidate = renderCache.drawSegments[i];
                if (candidate.commandIndex <= highlightIndex) {
                    highlightCommandIndex = candidate.commandIndex;
                    break;
                }
            }
        }

        for (const segment of renderCache.drawSegments) {
            if (segment.commandIndex >= limit) {
                break;
            }

            const highlight = highlightCommandIndex !== null && segment.commandIndex === highlightCommandIndex;
            applyBranchStroke(segment.depth ?? 0, segment.width ?? engine.settings.baseBranchWidth, {highlight});
            line(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
        }
    }

    function getTurtleIndicatorState(executedCount) {
        const commands = renderCache.commands;
        const defaultWidth = engine.settings.baseBranchWidth ?? 10;

        if (!Array.isArray(commands) || commands.length === 0) {
            return {
                position: {x: 0, y: 0},
                heading: -90,
                width: defaultWidth
            };
        }

        if (executedCount <= 0) {
            const first = commands[0];
            return {
                position: clonePoint(first.positionBefore || {x: 0, y: 0}),
                heading: Number.isFinite(first.headingBefore) ? first.headingBefore : -90,
                width: Number.isFinite(first.widthBefore) ? first.widthBefore : defaultWidth
            };
        }

        const index = Math.min(executedCount - 1, commands.length - 1);
        const command = commands[index];
        const position = command.positionAfter
            ? clonePoint(command.positionAfter)
            : clonePoint(command.positionBefore);
        const heading = Number.isFinite(command.headingAfter)
            ? command.headingAfter
            : Number.isFinite(command.headingBefore)
                ? command.headingBefore
                : -90;
        const width = Number.isFinite(command.widthAfter)
            ? command.widthAfter
            : Number.isFinite(command.widthBefore)
                ? command.widthBefore
                : defaultWidth;

        return {position, heading, width};
    }

    function drawTurtleIndicator({position, heading, width}) {
        if (!position) {
            return;
        }

        const baseSize = Math.max(6, (Number.isFinite(width) ? width : 8) * 2.2);

        push();
        colorMode(RGB, 255);
        translate(position.x, position.y);
        rotate(heading);

        stroke(15, 23, 42, 220);
        strokeWeight(1.5);
        fill(56, 189, 248, 170);

        beginShape();
        vertex(baseSize, 0);
        vertex(-baseSize * 0.6, baseSize * 0.55);
        vertex(-baseSize * 0.3, 0);
        vertex(-baseSize * 0.6, -baseSize * 0.55);
        endShape(CLOSE);

        noFill();
        stroke(56, 189, 248, 140);
        ellipse(0, 0, baseSize * 0.9, baseSize * 0.9);

        pop();
    }

    function windowResized() {
        const {width: nextWidth, height: nextHeight} = computeCanvasSize();
        if (nextWidth === engine.settings.canvasWidth && nextHeight === engine.settings.canvasHeight) {
            return;
        }

        engine.settings.canvasWidth = nextWidth;
        engine.settings.canvasHeight = nextHeight;

        if (typeof resizeCanvas === 'function') {
            resizeCanvas(nextWidth, nextHeight);
        }

        updateCanvasShellHeight(nextHeight);
        redraw();
    }

    function regenerateTree({silent = false} = {}) {
        engine.regenerate({silent});
        prepareRenderCache();

        if (playbackState.mode === 'step') {
            resetPlaybackState({preserveMode: true});
        } else {
            resetPlaybackState({preserveMode: false});
        }

        renderStatusPanel();
        redraw();
    }

    function applyFullSettingsSnapshot(snapshot, {silent = false} = {}) {
        if (!snapshot || typeof snapshot !== 'object') {
            return;
        }

        const settingsSnapshot = {};
        for (const key in snapshot) {
            if (!Object.prototype.hasOwnProperty.call(snapshot, key) || key === 'displayOptions') {
                continue;
            }
            settingsSnapshot[key] = snapshot[key];
        }

        const displaySnapshot =
            snapshot.displayOptions && typeof snapshot.displayOptions === 'object'
                ? {...snapshot.displayOptions}
                : null;

        engine.applySettingsSnapshot(settingsSnapshot, {skipRegenerate: true, silent: true});

        if (displaySnapshot) {
            setDisplayOptions(displaySnapshot);
        }

        regenerateTree({silent});
    }

    function prepareRenderCache() {
        const sentence = engine.getSentence() || '';
        const derived = deriveExecutionState(sentence, engine.settings);
        renderCache.commands = derived.commands;
        renderCache.drawSegments = derived.drawSegments;
        renderCache.branchCount = derived.branchCount;
        renderCache.bounds = derived.bounds;

        engine.updateBranchCount(derived.branchCount);
    }

    function resetPlaybackState({preserveMode = false} = {}) {
        const total = renderCache.commands.length;
        playbackState.playing = false;
        playbackState.lastFrameMillis = null;

        if (preserveMode) {
            playbackState.mode = 'step';
            playbackState.stepIndex = total > 0 ? 0 : 0;
        } else {
            playbackState.mode = 'static';
            playbackState.stepIndex = total;
        }

        noLoop();
    }

    function setDisplayOptions(patch = {}) {
        if (!patch || typeof patch !== 'object') {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(patch, 'showTurtleIndicator')) {
            displayOptions.showTurtleIndicator = Boolean(patch.showTurtleIndicator);
        }

        if (typeof redraw === 'function') {
            redraw();
        }
    }

    function getDisplayOptionsSnapshot() {
        return {
            showTurtleIndicator: Boolean(displayOptions.showTurtleIndicator)
        };
    }

    function clampStepIndex(value) {
        const total = renderCache.commands.length;
        if (total <= 0) {
            return 0;
        }
        return Math.min(Math.max(value, 0), total);
    }

    function setPlaybackMode(mode, {reset = true} = {}) {
        const target = mode === 'step' ? 'step' : 'static';
        if (target === playbackState.mode && !reset) {
            return;
        }

        if (target === 'step') {
            playbackState.mode = 'step';
            if (reset || playbackState.stepIndex >= renderCache.commands.length) {
                playbackState.stepIndex = 0;
            }
            playbackState.playing = false;
            playbackState.lastFrameMillis = null;
            noLoop();
        } else {
            playbackState.mode = 'static';
            playbackState.playing = false;
            playbackState.lastFrameMillis = null;
            playbackState.stepIndex = renderCache.commands.length;
            noLoop();
        }

        renderStatusPanel();
        redraw();
    }

    function toggleStepMode() {
        if (playbackState.mode === 'step') {
            setPlaybackMode('static');
        } else {
            setPlaybackMode('step', {reset: true});
        }
    }

    function stepPlayback(delta) {
        if (renderCache.commands.length === 0) {
            return;
        }
        if (playbackState.mode !== 'step') {
            setPlaybackMode('step', {reset: false});
        }

        pausePlayback();
        playbackState.stepIndex = clampStepIndex(playbackState.stepIndex + delta);
        playbackState.lastFrameMillis = null;
        redraw();
    }

    function resetStepPlayback() {
        if (renderCache.commands.length === 0) {
            return;
        }
        if (playbackState.mode !== 'step') {
            setPlaybackMode('step', {reset: true});
            return;
        }
        pausePlayback();
        playbackState.stepIndex = 0;
        playbackState.lastFrameMillis = null;
        redraw();
    }

    function setPlaybackSpeed(value) {
        const normalized = Number(value);
        if (!Number.isFinite(normalized)) {
            return;
        }
        playbackState.speed = Math.min(Math.max(normalized, 10), 4000);
    }

    function togglePlayback() {
        if (playbackState.mode !== 'step') {
            startPlayback({restart: true});
            return;
        }
        if (playbackState.playing) {
            pausePlayback();
        } else {
            startPlayback();
        }
    }

    function getPlaybackStateSnapshot() {
        return {
            mode: playbackState.mode,
            playing: playbackState.playing,
            stepIndex: playbackState.stepIndex,
            totalSteps: renderCache.commands.length,
            speed: playbackState.speed
        };
    }

    function advancePlayback() {
        if (!playbackState.playing) {
            return;
        }

        const total = renderCache.commands.length;
        if (total === 0) {
            playbackState.stepIndex = 0;
            pausePlayback();
            return;
        }

        const now = typeof millis === 'function' ? millis() : Date.now();
        const last = playbackState.lastFrameMillis ?? now;
        const deltaSeconds = Math.max(0, (now - last) / 1000);
        playbackState.lastFrameMillis = now;

        const increment = playbackState.speed * Math.max(deltaSeconds, 1 / 240);
        playbackState.stepIndex = clampStepIndex(playbackState.stepIndex + increment);

        if (playbackState.stepIndex >= total) {
            playbackState.stepIndex = total;
            pausePlayback();
        }
    }

    function startPlayback({restart = false} = {}) {
        if (renderCache.commands.length === 0) {
            return;
        }
        if (playbackState.mode !== 'step') {
            setPlaybackMode('step', {reset: true});
        }
        if (restart) {
            playbackState.stepIndex = 0;
        }
        playbackState.playing = true;
        playbackState.lastFrameMillis = null;
        loop();
    }

    function pausePlayback() {
        playbackState.playing = false;
        playbackState.lastFrameMillis = null;
        noLoop();
    }

    function deriveExecutionState(sentence, settings) {
        const commands = [];
        const drawSegments = [];
        const stack = [];
        let branchCount = 0;

        let position = {x: 0, y: 0};
        let heading = -90;
        let segmentWidth = settings.baseBranchWidth ?? 10;
        let segmentLength = settings.stepLength ?? 8;
        const widthDecay = settings.widthDecay ?? 0.7;
        const stepDecay = settings.stepDecay ?? 0.75;
        const turnAngle = settings.turnAngle ?? 25;

        const bounds = {
            minX: 0,
            maxX: 0,
            minY: 0,
            maxY: 0
        };
        let initializedBounds = false;

        for (let index = 0; index < sentence.length; index++) {
            const symbol = sentence[index];
            const command = {
                index,
                symbol,
                positionBefore: clonePoint(position),
                headingBefore: heading,
                stackDepth: stack.length,
                widthBefore: segmentWidth,
                lengthBefore: segmentLength,
                type: 'noop'
            };

            if (DRAW_COMMANDS.has(symbol)) {
                command.type = 'draw';
                const nextPos = advancePosition(position, heading, segmentLength);
                const segment = {
                    commandIndex: index,
                    depth: stack.length,
                    width: segmentWidth,
                    length: segmentLength,
                    start: clonePoint(position),
                    end: clonePoint(nextPos)
                };
                drawSegments.push(segment);
                position = nextPos;
                command.positionAfter = clonePoint(position);
                command.headingAfter = heading;
                command.widthAfter = segmentWidth;
                command.lengthAfter = segmentLength;
                command.stackDepthAfter = stack.length;
                branchCount++;

                if (!initializedBounds) {
                    bounds.minX = Math.min(segment.start.x, segment.end.x);
                    bounds.maxX = Math.max(segment.start.x, segment.end.x);
                    bounds.minY = Math.min(segment.start.y, segment.end.y);
                    bounds.maxY = Math.max(segment.start.y, segment.end.y);
                    initializedBounds = true;
                } else {
                    bounds.minX = Math.min(bounds.minX, segment.start.x, segment.end.x);
                    bounds.maxX = Math.max(bounds.maxX, segment.start.x, segment.end.x);
                    bounds.minY = Math.min(bounds.minY, segment.start.y, segment.end.y);
                    bounds.maxY = Math.max(bounds.maxY, segment.start.y, segment.end.y);
                }
            } else if (symbol === '+') {
                command.type = 'turn';
                heading += turnAngle;
                command.headingAfter = heading;
                command.positionAfter = clonePoint(position);
                command.widthAfter = segmentWidth;
                command.lengthAfter = segmentLength;
                command.stackDepthAfter = stack.length;
            } else if (symbol === '-') {
                command.type = 'turn';
                heading -= turnAngle;
                command.headingAfter = heading;
                command.positionAfter = clonePoint(position);
                command.widthAfter = segmentWidth;
                command.lengthAfter = segmentLength;
                command.stackDepthAfter = stack.length;
            } else if (symbol === '[') {
                command.type = 'push';
                stack.push({
                    position: clonePoint(position),
                    heading,
                    width: segmentWidth,
                    length: segmentLength
                });
                segmentWidth *= widthDecay;
                segmentLength *= stepDecay;
                command.positionAfter = clonePoint(position);
                command.headingAfter = heading;
                command.widthAfter = segmentWidth;
                command.lengthAfter = segmentLength;
                command.stackDepthAfter = stack.length;
            } else if (symbol === ']') {
                command.type = 'pop';
                const restored = stack.pop();
                if (restored) {
                    position = clonePoint(restored.position);
                    heading = restored.heading;
                    segmentWidth = restored.width;
                    segmentLength = restored.length;
                } else {
                    position = {x: 0, y: 0};
                    heading = -90;
                    segmentWidth = settings.baseBranchWidth ?? 10;
                    segmentLength = settings.stepLength ?? 8;
                }
                command.positionAfter = clonePoint(position);
                command.headingAfter = heading;
                command.widthAfter = segmentWidth;
                command.lengthAfter = segmentLength;
                command.stackDepthAfter = stack.length;
            } else {
                command.positionAfter = clonePoint(position);
                command.headingAfter = heading;
                command.widthAfter = segmentWidth;
                command.lengthAfter = segmentLength;
                command.stackDepthAfter = stack.length;
            }

            commands.push(command);
        }

        return {
            commands,
            drawSegments,
            branchCount,
            bounds: initializedBounds ? bounds : null
        };
    }

    function advancePosition(position, heading, distance) {
        const rad = degToRad(heading);
        const dx = Math.cos(rad) * distance;
        const dy = Math.sin(rad) * distance;
        return {
            x: position.x + dx,
            y: position.y + dy
        };
    }

    function clonePoint(point) {
        if (!point) {
            return {x: 0, y: 0};
        }
        return {x: point.x, y: point.y};
    }

    function degToRad(angle) {
        return (angle * Math.PI) / 180;
    }

    function applyBranchStroke(depth, currentWidth, {highlight = false} = {}) {
        const settings = engine.settings;
        const width = Math.max(0.4, Number.isFinite(currentWidth) ? currentWidth : settings.baseBranchWidth || 1);

        if (settings.colorize) {
            colorMode(HSB, 360, 100, 100);
            const hue = (settings.baseHue + depth * settings.hueStep) % 360;
            const saturation = map(depth, 0, 12, 25, 90);
            const brightness = highlight ? 82 : 65;
            stroke(hue, saturation, brightness);
            colorMode(RGB, 255);
        } else {
            const branch = settings.branchColor || [96, 70, 40];
            const boost = highlight ? 32 : 0;
            const r = Math.min(255, (branch[0] ?? 96) + boost);
            const g = Math.min(255, (branch[1] ?? 70) + boost);
            const b = Math.min(255, (branch[2] ?? 40) + boost);
            stroke(r, g, b);
        }

        strokeCap(ROUND);
        strokeWeight(Math.max(0.4, highlight ? width * 1.15 : width));
    }

    function computeCanvasSize() {
        if (typeof window === 'undefined') {
            return {
                width: engine.settings.canvasWidth || 800,
                height: engine.settings.canvasHeight || 600
            };
        }

        const minWidth = 320;
        const minHeight = 240;
        const marginX = 48;
        const marginY = 160;
        const baseWidth = engine.settings.canvasWidth || 800;
        const baseHeight = engine.settings.canvasHeight || 600;
        const aspectRatio = engine.aspectRatio || config.ASPECT_RATIO || (baseWidth / baseHeight);

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
        let height = Math.round(width / aspectRatio);

        const safeWindowHeight = Math.max(minHeight, window.innerHeight - marginY);
        let maxUsableHeight = safeWindowHeight;
        if (Number.isFinite(containerHeight) && containerHeight > 0) {
            maxUsableHeight = Math.min(maxUsableHeight, containerHeight);
        }
        maxUsableHeight = Math.max(minHeight, maxUsableHeight);

        if (height > maxUsableHeight) {
            height = Math.round(maxUsableHeight);
            width = Math.round(height * aspectRatio);

            if (Number.isFinite(containerWidth)) {
                width = Math.min(width, containerWidth);
            }
            width = Math.min(width, maxUsableWidth);
            height = Math.round(width / aspectRatio);
        }

        width = Math.max(minWidth, Math.min(width, maxUsableWidth));
        height = Math.max(minHeight, height);

        return {width, height};
    }

    function updateCanvasShellHeight(canvasHeight) {
        const container = document.getElementById('canvas-container');
        if (!container) {
            return;
        }

        if (Number.isFinite(canvasHeight)) {
            const clamped = Math.max(320, Math.round(canvasHeight));
            container.style.minHeight = `${clamped}px`;
        }

        const hint = container.querySelector('.loading-hint');
        if (hint) {
            hint.hidden = true;
        }
    }

    function renderStatusPanel() {
        if (typeof applyStatusPanelContent !== 'function') {
            return;
        }

        const stats = engine.stats;
        const settings = engine.settings;
        const leafEstimate = Math.max(1, Math.round(stats.branchCount * 0.3));
        const symbolLine = `<p><strong>処理した記号</strong>: ${stats.symbolCount}</p>`;
        const expandTimeLine =
            typeof stats.expandTimeMs === 'number'
                ? `<p><strong>生成時間</strong>: 約 ${stats.expandTimeMs} ms</p>`
                : '';

        const totalSteps = renderCache.commands.length;
        const currentStep = Math.floor(clampStepIndex(playbackState.stepIndex));
        const playbackLine = playbackState.mode === 'step'
            ? `<p><strong>ステップ再生</strong>: ${playbackState.playing ? '再生中' : '停止中'} (${currentStep} / ${totalSteps})<br><span class="step-speed">速度: ${Math.round(playbackState.speed)} 記号/秒</span></p>`
            : `<p><strong>ステップ再生</strong>: オフ</p>`;

        applyStatusPanelContent(`
    <p><strong>プリセット</strong>: ${engine.getPresetLabel(settings.presetKey)}</p>
    <p><strong>世代</strong>: ${settings.iterations}</p>
    <p><strong>書き換えた文字数</strong>: ${engine.getSentence().length}</p>
    ${symbolLine}
    <p><strong>枝の数</strong>: ${stats.branchCount}</p>
    <p><strong>想定される芽</strong>: 約 ${leafEstimate}</p>
    ${playbackLine}
    ${expandTimeLine}
  `);
    }

    function announceAppReady() {
        const app = {
            settings: engine.settings,
            presets: engine.presets,
            regenerate: () => regenerateTree({silent: false}),
            setSettings: (patch) => engine.setSettings(patch),
            setRule: (symbol, expansion) => engine.setRule(symbol, expansion),
            setRules: (rules) => engine.setRules(rules),
            applyPreset: (key, options = {}) => {
                engine.applyPreset(key, {skipRegenerate: true, silent: options.silent});
                regenerateTree({silent: options.silent});
            },
            getSentence: () => engine.getSentence(),
            getStats: () => engine.getStats(),
            getSettingsSnapshot: () => engine.getSettingsSnapshot(),
            getDisplayOptions: () => getDisplayOptionsSnapshot(),
            applySettingsSnapshot: (snapshot, options = {}) => applyFullSettingsSnapshot(snapshot, options),
            setDisplayOptions: (patch) => setDisplayOptions(patch),
            ruleControlKey: (symbol) => engine.ruleControlKey(symbol),
            serializeRule: (expansion) => engine.serializeRule(expansion),
            parseRuleInput: (value) => engine.parseRuleInput(value),
            getPlaybackState: () => getPlaybackStateSnapshot(),
            setPlaybackMode: (mode, options = {}) => setPlaybackMode(mode, options),
            togglePlayback: () => togglePlayback(),
            startPlayback: (options = {}) => startPlayback(options),
            pausePlayback: () => pausePlayback(),
            stepPlayback: (delta) => stepPlayback(delta),
            resetStepPlayback: () => resetStepPlayback(),
            setPlaybackSpeed: (value) => setPlaybackSpeed(value)
        };

        app.ensureGui = (mode = 'inline') => {
            if (!guiManager) {
                console.warn('[lsystem] GUI マネージャが利用できません');
                return;
            }
            guiManager.ensureGui(app, mode);
        };

        app.maybeAttachInlineGui = () => {
            if (!guiManager) {
                return;
            }
            guiManager.maybeAttachInlineGui(app);
        };

        window.LSYSTEM_APP = app;
        window.dispatchEvent(new CustomEvent('lsystem-ready', {detail: app}));
        return app;
    }

    function attachShortcuts() {
        const shortcutList = [
            {key: 'r', handler: () => regenerateTree({silent: false})},
            {
                key: 's',
                handler: () => {
                    if (typeof saveCanvasWithTimestamp === 'function') {
                        saveCanvasWithTimestamp('lsystem');
                    } else {
                        saveCanvas(`lsystem_${engine.settings.iterations}`, 'png');
                    }
                }
            },
            {key: 't', handler: () => toggleStepMode()},
            {key: ' ', handler: () => togglePlayback()},
            {
                key: 'arrowright',
                handler: (event) => {
                    const amount = event && event.shiftKey ? 10 : 1;
                    stepPlayback(amount);
                }
            },
            {
                key: 'arrowleft',
                handler: (event) => {
                    const amount = event && event.shiftKey ? 10 : 1;
                    stepPlayback(-amount);
                }
            },
            {key: '0', handler: () => resetStepPlayback()},
            {key: 'escape', handler: () => setPlaybackMode('static', {reset: false})}
        ];

        if (typeof registerKeyboardShortcuts === 'function') {
            registerKeyboardShortcuts(
                shortcutList.map((shortcut) => ({
                    key: shortcut.key,
                    handler: (event) => shortcut.handler(event)
                }))
            );
            return;
        }

        window.addEventListener('keydown', (event) => {
            const target = event.target;
            const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
            const isEditable = Boolean(
                (target && target.isContentEditable) ||
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select'
            );
            if (isEditable) {
                return;
            }

            const key = (event.key || '').toLowerCase();
            for (const shortcut of shortcutList) {
                if (shortcut.key === key) {
                    event.preventDefault();
                    shortcut.handler(event);
                    break;
                }
            }
        });
    }

    // p5.js が参照するグローバル関数を公開
    window.setup = setup;
    window.draw = draw;
    window.windowResized = windowResized;
})();
