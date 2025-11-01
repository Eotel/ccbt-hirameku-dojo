(() => {
    function createCellularAutomatonGui() {
        let guiInstance = null;
        let engineRef = null;
        let drawCallback = null;

        function maybeAttachInlineGui(context) {
            if (!context || typeof window.dat === 'undefined') {
                return;
            }

            engineRef = context.engine;
            drawCallback = context.redraw;

            if (!engineRef) {
                console.warn('[CA GUI] engine が提供されていません');
                return;
            }

            guiInstance = new window.dat.GUI({autoPlace: false, width: 320});

            const container = document.getElementById('gui-container');
            if (container) {
                container.appendChild(guiInstance.domElement);
            } else {
                document.body.appendChild(guiInstance.domElement);
            }

            buildGuiControls();
        }

        function buildGuiControls() {
            if (!guiInstance || !engineRef) {
                return;
            }

            const settings = engineRef.settings;
            const presets = engineRef.presets || {};
            const initialPatterns = engineRef.initialPatterns || {};

            // プリセット選択
            const presetOptions = {};
            for (const key in presets) {
                presetOptions[presets[key].label] = key;
            }
            presetOptions['カスタム'] = 'custom';

            const presetFolder = guiInstance.addFolder('プリセット');
            presetFolder.open();

            const presetController = {
                preset: settings.presetKey
            };

            presetFolder.add(presetController, 'preset', presetOptions)
                .name('選択')
                .onChange((key) => {
                    if (key !== 'custom') {
                        engineRef.applyPreset(key);
                        updateAllControllers();
                        triggerRedraw();
                    }
                });

            // ルール設定
            const ruleFolder = guiInstance.addFolder('ルール設定');
            ruleFolder.open();

            ruleFolder.add(settings, 'rule', 0, 255, 1)
                .name('ルール番号')
                .onChange(() => {
                    markCustom();
                    engineRef.regenerate();
                    triggerRedraw();
                });

            ruleFolder.add(settings, 'wraparound')
                .name('端で折り返す')
                .onChange(() => {
                    markCustom();
                    engineRef.regenerate();
                    triggerRedraw();
                });

            // 初期パターン
            const patternOptions = {};
            for (const key in initialPatterns) {
                patternOptions[initialPatterns[key].label] = key;
            }

            ruleFolder.add(settings, 'initialPattern', patternOptions)
                .name('初期パターン')
                .onChange(() => {
                    markCustom();
                    engineRef.regenerate();
                    triggerRedraw();
                });

            // 表示設定
            const displayFolder = guiInstance.addFolder('表示設定');
            displayFolder.open();

            displayFolder.add(settings, 'cellSize', 1, 20, 1)
                .name('セルサイズ')
                .onChange(() => {
                    markCustom();
                    engineRef.regenerate();
                    triggerRedraw();
                });

            // カラースキームの選択肢を動的に生成
            const colorSchemes = {};
            const schemes = window.CellularAutomatonConfig?.COLOR_SCHEMES || {};
            for (const key in schemes) {
                colorSchemes[schemes[key].label] = key;
            }

            displayFolder.add(settings, 'colorScheme', colorSchemes)
                .name('配色')
                .onChange(() => {
                    markCustom();
                    triggerRedraw();
                });

            displayFolder.add(settings, 'hue', 0, 360, 1)
                .name('色相')
                .onChange(() => {
                    markCustom();
                    triggerRedraw();
                });

            // 色設定
            const colorFolder = guiInstance.addFolder('色');
            colorFolder.addColor(settings, 'backgroundColor', 255)
                .name('背景色 (固定)')
                .onFinishChange((value) => {
                    const next = Array.isArray(value) ? value.slice() : value;
                    engineRef.setSettings({backgroundColor: next});
                    triggerRedraw();
                });

            colorFolder.addColor(settings, 'cellColor', 255)
                .name('セル色 (固定)')
                .onFinishChange((value) => {
                    const next = Array.isArray(value) ? value.slice() : value;
                    engineRef.setSettings({cellColor: next});
                    triggerRedraw();
                });

            // アニメーション設定
            const animFolder = guiInstance.addFolder('アニメーション');
            animFolder.add(settings, 'animationSpeed', 1, 120, 1)
                .name('速度 (世代/秒)')
                .onChange(() => {
                    markCustom();
                });

            // アクション
            const actions = {
                regenerate: () => {
                    engineRef.regenerate();
                    triggerRedraw();
                },
                stepOnce: () => {
                    engineRef.stepGeneration();
                    triggerRedraw();
                },
                exportImage: () => {
                    if (typeof window.saveCanvas === 'function') {
                        window.saveCanvas(`ca-rule${settings.rule}`, 'png');
                    }
                }
            };

            guiInstance.add(actions, 'regenerate').name('🔄 再生成');
            guiInstance.add(actions, 'stepOnce').name('⏭️ 1世代進む');
            guiInstance.add(actions, 'exportImage').name('💾 画像を保存');

            // ルール表示ヘルパー
            const ruleDisplay = {
                binary: '',
                neighborhoods: ''
            };

            const infoFolder = guiInstance.addFolder('ルール情報');
            infoFolder.add(ruleDisplay, 'binary').name('2進数表記').listen();
            infoFolder.add(ruleDisplay, 'neighborhoods').name('近傍パターン').listen();

            setInterval(() => {
                ruleDisplay.binary = engineRef.getRuleBinary();
                const neighborhoods = engineRef.getRuleNeighborhoods();
                ruleDisplay.neighborhoods = neighborhoods
                    .map(n => `${n.pattern}→${n.result}`)
                    .join(' ');
            }, 500);
        }

        function updateAllControllers() {
            if (!guiInstance) {
                return;
            }
            for (const folder of guiInstance.__folders) {
                folder.updateDisplay?.();
            }
            guiInstance.updateDisplay();
        }

        function markCustom() {
            if (engineRef) {
                engineRef.settings.presetKey = 'custom';
            }
        }

        function triggerRedraw() {
            if (typeof drawCallback === 'function') {
                drawCallback();
            }
        }

        function toggleVisibility() {
            if (!guiInstance) {
                return;
            }
            const elem = guiInstance.domElement;
            if (elem) {
                elem.style.display = elem.style.display === 'none' ? '' : 'none';
            }
        }

        function destroy() {
            if (guiInstance) {
                guiInstance.destroy();
                guiInstance = null;
            }
        }

        return {
            maybeAttachInlineGui,
            toggleVisibility,
            destroy
        };
    }

    window.CellularAutomatonGui = {
        create: createCellularAutomatonGui
    };
})();
