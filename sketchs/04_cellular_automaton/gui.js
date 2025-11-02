(() => {
    function createCellularAutomatonGui() {
        let guiInstance = null;
        let engineRef = null;
        let drawCallback = null;
        const customRuleUi = {
            ruleEditor: null,
            binaryController: null,
            ruleNumberController: null,
            patternState: {},
            patternControllers: [],
            info: null
        };
        let refreshRuleDisplays = () => {};

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

            customRuleUi.ruleEditor = {binary: engineRef.getRuleBinary()};
            customRuleUi.patternState = {};
            customRuleUi.patternControllers = [];
            customRuleUi.binaryController = null;
            customRuleUi.info = {
                binary: engineRef.getRuleBinary(),
                neighborhoods: ''
            };

            const applyNeighborhoodSnapshot = () => {
                const neighborhoods = engineRef.getRuleNeighborhoods();
                neighborhoods.forEach(({pattern, result}) => {
                    customRuleUi.patternState[pattern] = Boolean(result);
                });
                return neighborhoods;
            };

            const initialNeighborhoods = applyNeighborhoodSnapshot();

            refreshRuleDisplays = () => {
                const neighborhoods = applyNeighborhoodSnapshot();
                customRuleUi.ruleEditor.binary = engineRef.getRuleBinary();
                customRuleUi.info.binary = customRuleUi.ruleEditor.binary;
                customRuleUi.info.neighborhoods = neighborhoods
                    .map(n => `${n.pattern}→${n.result}`)
                    .join(' ');

                if (customRuleUi.binaryController) {
                    customRuleUi.binaryController.updateDisplay();
                }

                if (customRuleUi.ruleNumberController) {
                    customRuleUi.ruleNumberController.updateDisplay();
                }

                for (const entry of customRuleUi.patternControllers) {
                    entry.controller.updateDisplay();
                }
            };

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
                    refreshRuleDisplays();
                });

            // ルール設定
            const ruleFolder = guiInstance.addFolder('ルール設定');
            ruleFolder.open();

            customRuleUi.ruleNumberController = ruleFolder.add(settings, 'rule', 0, 255, 1)
                .name('ルール番号')
                .onChange(() => {
                    markCustom();
                    engineRef.regenerate();
                    triggerRedraw();
                    refreshRuleDisplays();
                });

            ruleFolder.add(settings, 'wraparound')
                .name('端で折り返す')
                .onChange(() => {
                    markCustom();
                    engineRef.regenerate();
                    triggerRedraw();
                });

            const customRuleFolder = ruleFolder.addFolder('カスタム編集');
            customRuleFolder.open();

            customRuleUi.binaryController = customRuleFolder
                .add(customRuleUi.ruleEditor, 'binary')
                .name('2進数(8桁)')
                .onFinishChange((value) => {
                    markCustom();
                    engineRef.setRuleBinary(value, {silent: true});
                    triggerRedraw();
                    refreshRuleDisplays();
                });

            for (const {pattern} of initialNeighborhoods) {
                const controller = customRuleFolder
                    .add(customRuleUi.patternState, pattern)
                    .name(`${pattern}`)
                    .onChange((value) => {
                        markCustom();
                        engineRef.setRuleNeighborhood(pattern, value ? 1 : 0, {silent: true});
                        triggerRedraw();
                        refreshRuleDisplays();
                    });
                customRuleUi.patternControllers.push({pattern, controller});
            }

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

            const shapeOptions = {
                '正方形': 'square',
                '円': 'circle',
                'ひし形': 'diamond'
            };

            displayFolder.add(settings, 'cellShape', shapeOptions)
                .name('セル形状')
                .onChange(() => {
                    markCustom();
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
            const infoFolder = guiInstance.addFolder('ルール情報');
            infoFolder.add(customRuleUi.info, 'binary').name('2進数表記').listen();
            infoFolder.add(customRuleUi.info, 'neighborhoods').name('近傍パターン').listen();

            refreshRuleDisplays();
        }

        function updateAllControllers() {
            if (!guiInstance) {
                return;
            }
            refreshRuleDisplays();
            const folders = guiInstance.__folders || {};
            for (const key in folders) {
                folders[key]?.updateDisplay?.();
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
