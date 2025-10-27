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

    function createGuiManager() {
        let guiInstance = null;
        let guiLoader = null;
        let guiMode = null;

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

            if (guiInstance && typeof guiInstance.destroy === 'function') {
                guiInstance.destroy();
            }

            guiInstance = new GuiCtor({width: 360});
            guiInstance.domElement.classList.add('lsystem-gui');
            window.__LSYSTEM_GUI_INSTANCE = guiInstance;

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
                initialRotation: snapshot.initialRotation ?? 0,
                originX: snapshot.origin?.x ?? 0.5,
                originY: snapshot.origin?.y ?? 0.92,
                newRuleSymbol: '',
                newRuleExpansion: '',
                regenerate: () => app.regenerate?.(),
                stepMode: playbackSnapshot.mode === 'step',
                playbackSpeed: playbackSnapshot.speed ?? 360
            };

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
                        state.initialRotation = newSnapshot.initialRotation ?? 0;
                        state.originX = newSnapshot.origin?.x ?? 0.5;
                        state.originY = newSnapshot.origin?.y ?? 0.92;

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

                playbackFolder.add(playbackActions, 'play').name('再生');
                playbackFolder.add(playbackActions, 'pause').name('一時停止');
                playbackFolder.add(playbackActions, 'stepForward').name('1ステップ進む');
                playbackFolder.add(playbackActions, 'stepBackward').name('1ステップ戻る');
                playbackFolder.add(playbackActions, 'reset').name('リセット');
                playbackFolder.open();
                syncPlaybackState(true);
            }

            const colors = guiInstance.addFolder('色');
            colors
                .add(state, 'colorize')
                .name('有効')
                .onChange((value) => {
                    app.setSettings?.({colorize: value});
                    app.regenerate?.();
                });
            colors
                .add(state, 'baseHue', 0, 360, 1)
                .name('基本色相')
                .onFinishChange((value) => {
                    app.setSettings?.({baseHue: value});
                    app.regenerate?.();
                });
            colors
                .add(state, 'hueStep', 0, 120, 1)
                .name('色相ステップ')
                .onFinishChange((value) => {
                    app.setSettings?.({hueStep: value});
                    app.regenerate?.();
                });

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
