(() => {
    if (typeof window !== 'undefined' && window.__LSYSTEM_CAPTURE_MODE) {
        const noopManager = {
            ensureGui: () => {
            },
            maybeAttachInlineGui: () => {
            }
        };
        window.LSystemGui = {
            create: () => noopManager
        };
        return;
    }

    const GUI_CDN = 'https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.min.js';
    const STORAGE_KEY = 'lsystem:01:settings';

    function createSettingsStorage(storageKey = STORAGE_KEY) {
        function isLocalStorageAvailable() {
            if (typeof window === 'undefined') {
                return false;
            }
            try {
                const {localStorage} = window;
                if (!localStorage) {
                    return false;
                }
                const probeKey = `${storageKey}__probe__`;
                localStorage.setItem(probeKey, '1');
                localStorage.removeItem(probeKey);
                return true;
            } catch (error) {
                return false;
            }
        }

        function clonePayload(data) {
            if (data === undefined) {
                return undefined;
            }
            try {
                return JSON.parse(JSON.stringify(data));
            } catch (error) {
                return undefined;
            }
        }

        function normalizeName(name) {
            if (typeof name !== 'string') {
                return '無題の設定';
            }
            const trimmed = name.trim();
            return trimmed ? trimmed : '無題の設定';
        }

        function generateId() {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            const random = Math.random().toString(16).slice(2);
            return `slot_${Date.now().toString(16)}_${random}`;
        }

        function readState() {
            if (!isLocalStorageAvailable()) {
                return {version: 1, slots: {}};
            }
            try {
                const raw = window.localStorage.getItem(storageKey);
                if (!raw) {
                    return {version: 1, slots: {}};
                }
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') {
                    return {version: 1, slots: {}};
                }
                const slots = parsed.slots && typeof parsed.slots === 'object' ? parsed.slots : {};
                return {
                    version: typeof parsed.version === 'number' ? parsed.version : 1,
                    slots
                };
            } catch (error) {
                console.warn('[lsystem] 設定保存データの読み込みに失敗しました', error);
                return {version: 1, slots: {}};
            }
        }

        function writeState(nextState) {
            if (!isLocalStorageAvailable()) {
                return false;
            }
            try {
                const payload = {
                    version: 1,
                    slots: nextState?.slots || {}
                };
                window.localStorage.setItem(storageKey, JSON.stringify(payload));
                return true;
            } catch (error) {
                console.warn('[lsystem] 設定保存データの書き込みに失敗しました', error);
                return false;
            }
        }

        function list() {
            const state = readState();
            const slots = state.slots || {};
            return Object.keys(slots)
                .map((id) => {
                    const entry = slots[id] || {};
                    return {
                        id,
                        name: normalizeName(entry.name || id),
                        savedAt: entry.savedAt || null,
                        settings: clonePayload(entry.settings) || {},
                        displayOptions: clonePayload(entry.displayOptions) || {}
                    };
                })
                .sort((a, b) => {
                    const timeA = a.savedAt ? Date.parse(a.savedAt) : 0;
                    const timeB = b.savedAt ? Date.parse(b.savedAt) : 0;
                    return timeB - timeA;
                });
        }

        function get(id) {
            if (!id) {
                return null;
            }
            const state = readState();
            const entry = state.slots?.[id];
            if (!entry) {
                return null;
            }
            return {
                id,
                name: normalizeName(entry.name || id),
                savedAt: entry.savedAt || null,
                settings: clonePayload(entry.settings) || {},
                displayOptions: clonePayload(entry.displayOptions) || {}
            };
        }

        function create(name, payload) {
            if (!payload || typeof payload !== 'object') {
                return null;
            }
            const state = readState();
            const id = generateId();
            state.slots = state.slots || {};
            state.slots[id] = {
                name: normalizeName(name),
                savedAt: new Date().toISOString(),
                settings: clonePayload(payload.settings) || {},
                displayOptions: clonePayload(payload.displayOptions) || {}
            };
            if (!writeState(state)) {
                return null;
            }
            return get(id);
        }

        function update(id, payload, options = {}) {
            if (!id || !payload || typeof payload !== 'object') {
                return null;
            }
            const state = readState();
            if (!state.slots || !state.slots[id]) {
                return null;
            }
            const entry = state.slots[id];
            if (options && typeof options.name === 'string' && options.name.trim()) {
                entry.name = normalizeName(options.name);
            }
            entry.settings = clonePayload(payload.settings) || {};
            entry.displayOptions = clonePayload(payload.displayOptions) || {};
            entry.savedAt = new Date().toISOString();
            if (!writeState(state)) {
                return null;
            }
            return get(id);
        }

        function remove(id) {
            if (!id) {
                return false;
            }
            const state = readState();
            if (!state.slots || !state.slots[id]) {
                return false;
            }
            delete state.slots[id];
            return writeState(state);
        }

        function importEntry(payload) {
            if (!payload || typeof payload !== 'object') {
                return null;
            }
            const name = typeof payload.name === 'string' ? payload.name : undefined;
            const settings = payload.settings && typeof payload.settings === 'object'
                ? payload.settings
                : payload;
            const displayOptions = payload.displayOptions && typeof payload.displayOptions === 'object'
                ? payload.displayOptions
                : {};
            return create(name, {settings, displayOptions});
        }

        function exportEntry(id) {
            const entry = get(id);
            if (!entry) {
                return null;
            }
            return {
                name: entry.name,
                savedAt: entry.savedAt,
                settings: entry.settings,
                displayOptions: entry.displayOptions
            };
        }

        return {
            isAvailable: () => isLocalStorageAvailable(),
            list,
            get,
            create,
            update,
            remove,
            importEntry,
            exportEntry
        };
    }

    function createGuiManager() {
        let guiInstance = null;
        let guiLoader = null;
        let guiMode = null;
        const storage = createSettingsStorage();
        let lastSelectedSlotId = '__none__';
        let lastStorageMessage = storage.isAvailable()
            ? 'localStorage に保存されます'
            : 'localStorage が利用できません';

        function pad2(value) {
            return String(value).padStart(2, '0');
        }

        function formatTimestampLabel(isoString) {
            if (!isoString) {
                return '---';
            }
            const date = new Date(isoString);
            if (Number.isNaN(date.getTime())) {
                return '---';
            }
            return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
        }

        function buildSavedOptions(entries) {
            const options = {};
            for (const entry of entries) {
                const label = `${entry.name} (${formatTimestampLabel(entry.savedAt)})`;
                options[label] = entry.id;
            }
            options['選択なし'] = '__none__';
            return options;
        }

        function summarizeEntry(entries, id) {
            if (!id || id === '__none__') {
                return '---';
            }
            const entry = entries.find((candidate) => candidate.id === id);
            if (!entry) {
                return '---';
            }
            return formatTimestampLabel(entry.savedAt);
        }

        function ensureGui(app, mode = 'inline') {
            if (!app) {
                console.warn('[lsystem] GUI を構築するためのアプリケーション参照がありません');
                return;
            }

            const nextMode = mode || 'inline';
            guiMode = nextMode;
            window.__LSYSTEM_GUI_MODE = nextMode;

            loadGuiConstructor()
                .then((GuiCtor) => buildGui(GuiCtor, app))
                .catch((error) => {
                    console.warn('[lsystem] dat.GUI load failed', error);
                    if (window.__LSYSTEM_GUI_MODE === nextMode) {
                        window.__LSYSTEM_GUI_MODE = null;
                    }
                });
        }

        function maybeAttachInlineGui(app) {
            if (typeof window === 'undefined') {
                return;
            }
            window.requestAnimationFrame(() => {
                if (window.__LSYSTEM_GUI_MODE || !app) {
                    return;
                }
                ensureGui(app, 'inline');
            });
        }

        function loadGuiConstructor() {
            if (typeof window === 'undefined') {
                return Promise.reject(new Error('No window context'));
            }
            if (window.lil && window.lil.GUI) {
                return Promise.resolve(window.lil.GUI);
            }
            if (window.dat && window.dat.GUI) {
                return Promise.resolve(window.dat.GUI);
            }
            if (!guiLoader) {
                guiLoader = new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.async = true;
                    script.src = GUI_CDN;
                    script.onload = () => {
                        if (window.dat && window.dat.GUI) {
                            resolve(window.dat.GUI);
                        } else if (window.lil && window.lil.GUI) {
                            resolve(window.lil.GUI);
                        } else {
                            reject(new Error('dat.GUI が GUI コンストラクタを公開しませんでした'));
                        }
                    };
                    script.onerror = () => reject(new Error('dat.GUI の読み込みに失敗しました'));
                    document.head.appendChild(script);
                });
            }
            return guiLoader;
        }

        function buildGui(GuiCtor, app) {
            if (!GuiCtor || !app) {
                return;
            }

            const snapshot = typeof app.getSettingsSnapshot === 'function'
                ? app.getSettingsSnapshot()
                : {};
            const playbackSnapshot = typeof app.getPlaybackState === 'function'
                ? app.getPlaybackState()
                : {mode: 'static', speed: 360, playing: false};
            const displaySnapshot = typeof app.getDisplayOptions === 'function'
                ? app.getDisplayOptions()
                : {};

            if (guiInstance && typeof guiInstance.destroy === 'function') {
                guiInstance.destroy();
            }

            guiInstance = new GuiCtor({width: 360});
            guiInstance.domElement.classList.add('lsystem-gui');
            window.__LSYSTEM_GUI_INSTANCE = guiInstance;

            const storageAvailable = storage.isAvailable();
            const savedEntries = storageAvailable ? storage.list() : [];
            if (storageAvailable) {
                const entryIds = savedEntries.map((entry) => entry.id);
                if (!entryIds.includes(lastSelectedSlotId)) {
                    lastSelectedSlotId = entryIds[0] || '__none__';
                }
                if (!lastStorageMessage) {
                    lastStorageMessage = 'localStorage に保存されます';
                }
            } else {
                lastSelectedSlotId = '__none__';
                lastStorageMessage = 'localStorage が利用できません';
            }

            const state = {
                presetKey: snapshot.presetKey || 'custom',
                axiom: snapshot.axiom || 'F',
                iterations: snapshot.iterations ?? 4,
                turnAngle: snapshot.turnAngle ?? 25,
                stepLength: snapshot.stepLength ?? 8,
                stepDecay: snapshot.stepDecay ?? 0.75,
                widthDecay: snapshot.widthDecay ?? 0.7,
                baseBranchWidth: snapshot.baseBranchWidth ?? 10,
                colorize: Boolean(snapshot.colorize),
                baseHue: snapshot.baseHue ?? 120,
                hueStep: snapshot.hueStep ?? 5,
                branchColor: Array.isArray(snapshot.branchColor)
                    ? [...snapshot.branchColor]
                    : [96, 70, 40],
                backgroundColor: Array.isArray(snapshot.backgroundColor)
                    ? [...snapshot.backgroundColor]
                    : [240, 248, 255],
                initialRotation: snapshot.initialRotation ?? 0,
                originX: snapshot.origin?.x ?? 0.5,
                originY: snapshot.origin?.y ?? 0.92,
                newRuleSymbol: '',
                newRuleExpansion: '',
                regenerate: () => app.regenerate?.(),
                stepMode: playbackSnapshot.mode === 'step',
                playbackSpeed: playbackSnapshot.speed ?? 360,
                showTurtleIndicator: Boolean(displaySnapshot.showTurtleIndicator),
                saveSlotName: '',
                savedSlotId: '__none__',
                savedSlotInfo: '---',
                importJson: '',
                storageStatus: lastStorageMessage || ''
            };

            state.savedSlotId = lastSelectedSlotId;
            state.savedSlotInfo = summarizeEntry(savedEntries, state.savedSlotId);
            state.importJson = '';
            state.storageStatus = lastStorageMessage || '';

            const rules = snapshot.rules || {};
            const ruleKeys = Object.keys(rules).sort();
            const rulePropertyMap = new Map();
            for (const symbol of ruleKeys) {
                const propertyName = app.ruleControlKey?.(symbol) || `rule_${symbol}`;
                state[propertyName] = app.serializeRule?.(rules[symbol]) ?? '';
                rulePropertyMap.set(symbol, propertyName);
            }

            const rebuild = () => window.requestAnimationFrame(() => buildGui(GuiCtor, app));

            const presetKeys = Object.keys(app.presets || {});
            if (presetKeys.length > 0) {
                const presetFolder = guiInstance.addFolder('プリセット');
                // 日本語ラベルでプリセットを表示しつつ、内部値はキーを保持
                const optionsMap = {};
                for (const key of presetKeys) {
                    const preset = app.presets[key];
                    optionsMap[preset?.label || key] = key;
                }
                optionsMap['カスタム'] = 'custom';

                const presetController = presetFolder.add(state, 'presetKey', optionsMap).name('プリセット選択');

                // 初回ロード時に正しい値を反映
                window.requestAnimationFrame(() => {
                    presetController.setValue(state.presetKey);
                    presetController.updateDisplay();
                });

                presetController.onFinishChange((selectedKey) => {
                    // onFinishChange には選択された値（プリセットキー）が渡される
                    state.presetKey = selectedKey;

                    if (selectedKey === 'custom') {
                        return;
                    }
                    if (app.applyPreset) {
                        app.applyPreset(selectedKey);
                        // GUIを再構築せずに、各コントローラーを更新
                        const newSnapshot = app.getSettingsSnapshot();

                        // ルールの更新
                        for (const [symbol, propertyName] of rulePropertyMap.entries()) {
                            if (newSnapshot.rules && newSnapshot.rules[symbol]) {
                                state[propertyName] = app.serializeRule?.(newSnapshot.rules[symbol]) ?? '';
                            }
                        }

                        // その他の設定を更新
                        state.axiom = newSnapshot.axiom || 'F';
                        state.iterations = newSnapshot.iterations ?? 4;
                        state.turnAngle = newSnapshot.turnAngle ?? 25;
                        state.stepLength = newSnapshot.stepLength ?? 8;
                        state.stepDecay = newSnapshot.stepDecay ?? 0.75;
                        state.widthDecay = newSnapshot.widthDecay ?? 0.7;
                        state.baseBranchWidth = newSnapshot.baseBranchWidth ?? 10;
                        state.colorize = Boolean(newSnapshot.colorize);
                        state.baseHue = newSnapshot.baseHue ?? 120;
                        state.hueStep = newSnapshot.hueStep ?? 5;
                        state.branchColor = Array.isArray(newSnapshot.branchColor)
                            ? [...newSnapshot.branchColor]
                            : [96, 70, 40];
                        state.backgroundColor = Array.isArray(newSnapshot.backgroundColor)
                            ? [...newSnapshot.backgroundColor]
                            : [240, 248, 255];
                        state.initialRotation = newSnapshot.initialRotation ?? 0;
                        state.originX = newSnapshot.origin?.x ?? 0.5;
                        state.originY = newSnapshot.origin?.y ?? 0.92;
                        state.showTurtleIndicator = Boolean(app.getDisplayOptions?.()?.showTurtleIndicator);

                        // すべてのコントローラーの表示を更新
                        function updateAllDisplays(folder) {
                            for (const controller of folder.__controllers) {
                                controller.updateDisplay();
                            }
                            for (const subfolder in folder.__folders) {
                                updateAllDisplays(folder.__folders[subfolder]);
                            }
                        }

                        updateAllDisplays(guiInstance);

                        // 最後に再生成
                        app.regenerate?.();
                    }
                });
                presetFolder.open();
            }

            const grammar = guiInstance.addFolder('文法');
            grammar.add(state, 'axiom').name('開始文字列').onFinishChange((value) => {
                app.setSettings?.({axiom: value});
                app.regenerate?.();
            });

            for (const [symbol, propertyName] of rulePropertyMap.entries()) {
                grammar
                    .add(state, propertyName)
                    .name(`ルール ${symbol}`)
                    .onFinishChange((value) => {
                        const parser = app.parseRuleInput || ((v) => v);
                        const parsed = parser(value);
                        app.setRule?.(symbol, parsed);
                        app.regenerate?.();
                    });
            }

            grammar.add(state, 'newRuleSymbol').name('新規記号');
            grammar.add(state, 'newRuleExpansion').name('新規ルール');
            grammar
                .add(
                    {
                        add: () => {
                            const symbol = (state.newRuleSymbol || '').trim();
                            if (!symbol) {
                                console.warn('[lsystem] 追加する記号を入力してください');
                                return;
                            }
                            const parser = app.parseRuleInput || ((v) => v);
                            const parsed = parser(state.newRuleExpansion);
                            app.setRule?.(symbol, parsed);
                            state.newRuleSymbol = '';
                            state.newRuleExpansion = '';
                            app.regenerate?.();
                            rebuild();
                        }
                    },
                    'add'
                )
                .name('ルール追加');
            grammar.open();

            const growth = guiInstance.addFolder('成長');
            growth
                .add(state, 'iterations', 1, 20, 1)
                .name('繰り返し回数')
                .onFinishChange((value) => {
                    app.setSettings?.({iterations: value});
                    app.regenerate?.();
                });
            growth
                .add(state, 'turnAngle', 0, 360, 1)
                .name('回転角度')
                .onFinishChange((value) => {
                    app.setSettings?.({turnAngle: value});
                    app.regenerate?.();
                });
            growth
                .add(state, 'stepLength', 1, 160, 1)
                .name('ステップ長')
                .onFinishChange((value) => {
                    app.setSettings?.({stepLength: value});
                    app.regenerate?.();
                });
            growth
                .add(state, 'stepDecay', 0.3, 1.2, 0.01)
                .name('長さ減衰率')
                .onFinishChange((value) => {
                    app.setSettings?.({stepDecay: value});
                    app.regenerate?.();
                });
            growth
                .add(state, 'widthDecay', 0.2, 1.1, 0.01)
                .name('幅減衰率')
                .onFinishChange((value) => {
                    app.setSettings?.({widthDecay: value});
                    app.regenerate?.();
                });
            growth
                .add(state, 'baseBranchWidth', 1, 32, 1)
                .name('基本幅')
                .onFinishChange((value) => {
                    app.setSettings?.({baseBranchWidth: value});
                    app.regenerate?.();
                });
            growth.open();

            const layout = guiInstance.addFolder('レイアウト');
            layout
                .add(state, 'initialRotation', -180, 180, 1)
                .name('初期回転')
                .onFinishChange((value) => {
                    app.setSettings?.({initialRotation: value});
                    app.regenerate?.();
                });
            layout
                .add(state, 'originX', -0.2, 1.2, 0.01)
                .name('原点 X')
                .onFinishChange((value) => {
                    state.originX = value;
                    app.setSettings?.({origin: {x: value, y: state.originY}});
                    app.regenerate?.();
                });
            layout
                .add(state, 'originY', -0.2, 1.2, 0.01)
                .name('原点 Y')
                .onFinishChange((value) => {
                    state.originY = value;
                    app.setSettings?.({origin: {x: state.originX, y: value}});
                    app.regenerate?.();
                });

            if (typeof app.getPlaybackState === 'function') {
                let stepModeController = null;
                let speedController = null;

                const syncPlaybackState = (updateDisplays = false) => {
                    const playbackState = app.getPlaybackState?.();
                    if (!playbackState) {
                        return;
                    }
                    state.stepMode = playbackState.mode === 'step';
                    state.playbackSpeed = playbackState.speed ?? state.playbackSpeed;
                    if (updateDisplays) {
                        if (stepModeController) stepModeController.updateDisplay();
                        if (speedController) speedController.updateDisplay();
                    }
                };

                const playbackActions = {
                    play: () => {
                        app.startPlayback?.();
                        syncPlaybackState(true);
                    },
                    pause: () => {
                        app.pausePlayback?.();
                        syncPlaybackState(true);
                    },
                    stepForward: () => {
                        app.stepPlayback?.(1);
                        syncPlaybackState(true);
                    },
                    stepBackward: () => {
                        app.stepPlayback?.(-1);
                        syncPlaybackState(true);
                    },
                    reset: () => {
                        app.resetStepPlayback?.();
                        syncPlaybackState(true);
                    }
                };

                const playbackFolder = guiInstance.addFolder('再生');
                stepModeController = playbackFolder
                    .add(state, 'stepMode')
                    .name('ステップモード')
                    .onFinishChange((value) => {
                        if (value) {
                            app.setPlaybackMode?.('step', {reset: true});
                        } else {
                            app.setPlaybackMode?.('static', {reset: false});
                        }
                        syncPlaybackState(true);
                    });

                speedController = playbackFolder
                    .add(state, 'playbackSpeed', 10, 4000, 10)
                    .name('速度 (記号/秒)')
                    .onFinishChange((value) => {
                        app.setPlaybackSpeed?.(value);
                        syncPlaybackState(true);
                    });

                playbackFolder
                    .add(state, 'showTurtleIndicator')
                    .name('タートル表示')
                    .onChange((value) => {
                        state.showTurtleIndicator = value;
                        app.setDisplayOptions?.({showTurtleIndicator: value});
                    });

                playbackFolder.add(playbackActions, 'play').name('再生');
                playbackFolder.add(playbackActions, 'pause').name('一時停止');
                playbackFolder.add(playbackActions, 'stepForward').name('1ステップ進む');
                playbackFolder.add(playbackActions, 'stepBackward').name('1ステップ戻る');
                playbackFolder.add(playbackActions, 'reset').name('リセット');
                playbackFolder.open();
                syncPlaybackState(true);
            }

            const colors = guiInstance.addFolder('色');
            const backgroundController = colors
                .addColor(state, 'backgroundColor', 255)
                .name('背景色 (固定)')
                .onFinishChange((value) => {
                    const next = Array.isArray(value) ? value.slice() : value;
                    app.setSettings?.({backgroundColor: next});
                    app.regenerate?.();
                });
            const branchController = colors
                .addColor(state, 'branchColor', 255)
                .name('枝色 (固定)')
                .onFinishChange((value) => {
                    const next = Array.isArray(value) ? value.slice() : value;
                    app.setSettings?.({branchColor: next});
                    app.regenerate?.();
                });
            colors
                .add(state, 'colorize')
                .name('有効')
                .onChange((value) => {
                    app.setSettings?.({colorize: value});
                    app.regenerate?.();
                });
            colors
                .add(state, 'baseHue', 0, 360, 1)
                .name('線のベース色 (色相)')
                .onFinishChange((value) => {
                    app.setSettings?.({baseHue: value});
                    app.regenerate?.();
                });
            colors
                .add(state, 'hueStep', 0, 120, 1)
                .name('線の色ステップ (色相)')
                .onFinishChange((value) => {
                    app.setSettings?.({hueStep: value});
                    app.regenerate?.();
                });

            // プリセット切り替え時にもカラーコントローラーを追従させる
            if (backgroundController && typeof backgroundController.updateDisplay === 'function') {
                backgroundController.updateDisplay();
            }
            if (branchController && typeof branchController.updateDisplay === 'function') {
                branchController.updateDisplay();
            }

            const storageFolder = guiInstance.addFolder('設定管理');
            if (!storageAvailable) {
                const statusState = {
                    message: 'localStorage が利用できません'
                };
                storageFolder.add(statusState, 'message').name('ステータス');
                storageFolder.open();
            } else {
                const savedOptions = buildSavedOptions(savedEntries);
                const collectSnapshot = () => {
                    const settingsSnapshot = app.getSettingsSnapshot?.();
                    if (!settingsSnapshot || typeof settingsSnapshot !== 'object') {
                        return null;
                    }
                    const displayOptionsSnapshot = app.getDisplayOptions?.();
                    return {
                        settings: settingsSnapshot,
                        displayOptions: displayOptionsSnapshot && typeof displayOptionsSnapshot === 'object'
                            ? displayOptionsSnapshot
                            : {}
                    };
                };

                const savedNameController = storageFolder
                    .add(state, 'saveSlotName')
                    .name('新規保存名');

                let savedInfoController = null;
                let statusController = null;

                const savedSelectController = storageFolder
                    .add(state, 'savedSlotId', savedOptions)
                    .name('保存済み一覧')
                    .onChange((value) => {
                        lastSelectedSlotId = value;
                        state.savedSlotId = value;
                        state.savedSlotInfo = summarizeEntry(savedEntries, value);
                        if (savedInfoController) {
                            savedInfoController.updateDisplay();
                        }
                    });

                savedSelectController.setValue(state.savedSlotId);
                savedSelectController.updateDisplay();

                savedInfoController = storageFolder
                    .add(state, 'savedSlotInfo')
                    .name('最終更新')
                    .listen();

                statusController = storageFolder
                    .add(state, 'storageStatus')
                    .name('メッセージ')
                    .listen();

                const importController = storageFolder
                    .add(state, 'importJson')
                    .name('JSON貼り付け');
                importController.onFinishChange((value) => {
                    state.importJson = value;
                });
                importController.listen();

                const setStatusMessage = (message) => {
                    lastStorageMessage = message || '';
                    state.storageStatus = lastStorageMessage;
                    if (statusController) {
                        statusController.updateDisplay();
                    }
                };

                const storageActions = {
                    saveNew: () => {
                        const payload = collectSnapshot();
                        if (!payload) {
                            setStatusMessage('保存用の設定を取得できませんでした');
                            return;
                        }
                        const entry = storage.create(state.saveSlotName || '', payload);
                        if (!entry) {
                            setStatusMessage('保存に失敗しました');
                            return;
                        }
                        lastSelectedSlotId = entry.id;
                        state.saveSlotName = '';
                        state.savedSlotId = entry.id;
                        state.savedSlotInfo = formatTimestampLabel(entry.savedAt);
                        if (savedNameController) {
                            savedNameController.updateDisplay();
                        }
                        if (savedInfoController) {
                            savedInfoController.updateDisplay();
                        }
                        setStatusMessage(`保存しました: ${entry.name}`);
                        rebuild();
                    },
                    overwriteSelected: () => {
                        const targetId = state.savedSlotId;
                        if (!targetId || targetId === '__none__') {
                            setStatusMessage('上書きする保存を選んでください');
                            return;
                        }
                        const payload = collectSnapshot();
                        if (!payload) {
                            setStatusMessage('保存用の設定を取得できませんでした');
                            return;
                        }
                        const entry = storage.update(targetId, payload, {name: state.saveSlotName || undefined});
                        if (!entry) {
                            setStatusMessage('上書きに失敗しました');
                            return;
                        }
                        lastSelectedSlotId = entry.id;
                        state.saveSlotName = '';
                        state.savedSlotId = entry.id;
                        state.savedSlotInfo = formatTimestampLabel(entry.savedAt);
                        if (savedNameController) {
                            savedNameController.updateDisplay();
                        }
                        if (savedInfoController) {
                            savedInfoController.updateDisplay();
                        }
                        setStatusMessage(`上書きしました: ${entry.name}`);
                        rebuild();
                    },
                    loadSelected: () => {
                        const targetId = state.savedSlotId;
                        if (!targetId || targetId === '__none__') {
                            setStatusMessage('読み込む保存を選んでください');
                            return;
                        }
                        const entry = storage.get(targetId);
                        if (!entry) {
                            setStatusMessage('設定を読み込めませんでした');
                            return;
                        }
                        const snapshot = {
                            ...entry.settings,
                            displayOptions: entry.displayOptions || {}
                        };
                        if (typeof app.applySettingsSnapshot === 'function') {
                            app.applySettingsSnapshot(snapshot, {silent: false});
                        } else {
                            app.setSettings?.(entry.settings);
                            if (entry.displayOptions) {
                                app.setDisplayOptions?.(entry.displayOptions);
                            }
                            app.regenerate?.();
                        }
                        state.savedSlotInfo = formatTimestampLabel(entry.savedAt);
                        if (savedInfoController) {
                            savedInfoController.updateDisplay();
                        }
                        setStatusMessage(`読み込みました: ${entry.name}`);
                        lastSelectedSlotId = entry.id;
                        rebuild();
                    },
                    deleteSelected: () => {
                        const targetId = state.savedSlotId;
                        if (!targetId || targetId === '__none__') {
                            setStatusMessage('削除する保存を選んでください');
                            return;
                        }
                        const success = storage.remove(targetId);
                        if (!success) {
                            setStatusMessage('削除に失敗しました');
                            return;
                        }
                        const remaining = storage.list();
                        lastSelectedSlotId = remaining[0]?.id || '__none__';
                        state.savedSlotId = lastSelectedSlotId;
                        state.savedSlotInfo = summarizeEntry(remaining, lastSelectedSlotId);
                        if (savedInfoController) {
                            savedInfoController.updateDisplay();
                        }
                        setStatusMessage('保存を削除しました');
                        rebuild();
                    },
                    exportSelected: () => {
                        const targetId = state.savedSlotId;
                        if (!targetId || targetId === '__none__') {
                            setStatusMessage('エクスポートする保存を選んでください');
                            return;
                        }
                        const entry = storage.exportEntry(targetId);
                        if (!entry) {
                            setStatusMessage('エクスポートに失敗しました');
                            return;
                        }
                        const json = JSON.stringify(entry, null, 2);
                        const fallback = () => {
                            if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
                                window.prompt('以下のJSONをコピーしてください', json);
                                setStatusMessage('JSONを表示しました');
                            } else {
                                console.info('[lsystem] 設定JSON', json);
                                setStatusMessage('JSONをコンソールに出力しました');
                            }
                        };
                        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                            navigator.clipboard
                                .writeText(json)
                                .then(() => {
                                    setStatusMessage('JSONをクリップボードにコピーしました');
                                })
                                .catch(() => {
                                    fallback();
                                });
                        } else {
                            fallback();
                        }
                    },
                    importFromJson: () => {
                        const raw = (state.importJson || '').trim();
                        if (!raw) {
                            setStatusMessage('JSON文字列を入力してください');
                            return;
                        }
                        let parsed;
                        try {
                            parsed = JSON.parse(raw);
                        } catch (error) {
                            setStatusMessage('JSONの解析に失敗しました');
                            return;
                        }
                        const entry = storage.importEntry(parsed);
                        if (!entry) {
                            setStatusMessage('インポートに失敗しました');
                            return;
                        }
                        state.importJson = '';
                        lastSelectedSlotId = entry.id;
                        state.savedSlotId = entry.id;
                        state.savedSlotInfo = formatTimestampLabel(entry.savedAt);
                        if (savedInfoController) {
                            savedInfoController.updateDisplay();
                        }
                        setStatusMessage(`インポートしました: ${entry.name}`);
                        rebuild();
                    }
                };

                storageFolder.add(storageActions, 'saveNew').name('新規保存');
                storageFolder.add(storageActions, 'overwriteSelected').name('選択を上書き');
                storageFolder.add(storageActions, 'loadSelected').name('選択を読み込み');
                storageFolder.add(storageActions, 'deleteSelected').name('選択を削除');
                storageFolder.add(storageActions, 'exportSelected').name('JSONをコピー');
                storageFolder.add(storageActions, 'importFromJson').name('JSONを取り込む');
                storageFolder.open();
            }

            guiInstance.add(state, 'regenerate').name('再生成');
        }

        return {
            ensureGui,
            maybeAttachInlineGui
        };
    }

    window.LSystemGui = {
        create: createGuiManager
    };
})();
