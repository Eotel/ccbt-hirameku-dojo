(() => {
    function createCellularAutomatonEngine({config, utils}) {
        if (!config) {
            throw new Error('CellularAutomatonConfig が読み込まれていません');
        }
        if (!utils) {
            throw new Error('Utils が読み込まれていません');
        }

        const {
            PRESETS = {},
            DEFAULT_PRESET_KEY = 'rule30',
            BASE_TEMPLATE = {},
            ASPECT_RATIO = 4 / 3,
            INITIAL_PATTERNS = {}
        } = config;

        const {
            clampNumber, clampToInt, normalizeColor, deepClone
        } = utils;

        const baseTemplate = deepClone ? deepClone(BASE_TEMPLATE) : structuredCloneFallback(BASE_TEMPLATE);

        const settings = {
            canvasWidth: 800,
            canvasHeight: 600,
            presetKey: DEFAULT_PRESET_KEY,
            rule: baseTemplate.rule ?? 30,
            cellSize: baseTemplate.cellSize ?? 4,
            initialPattern: baseTemplate.initialPattern ?? 'single',
            wraparound: baseTemplate.wraparound ?? false,
            colorScheme: baseTemplate.colorScheme ?? 'classic',
            hue: baseTemplate.hue ?? 220,
            backgroundColor: [...(baseTemplate.backgroundColor ?? [245, 248, 252])],
            cellColor: [...(baseTemplate.cellColor ?? [30, 41, 59])],
            animationSpeed: baseTemplate.animationSpeed ?? 30
        };

        const stats = {
            generation: 0,
            aliveCells: 0,
            totalCells: 0
        };

        let grid = [];
        let currentGeneration = [];
        let ruleTable = [];

        function structuredCloneFallback(source) {
            return JSON.parse(JSON.stringify(source ?? {}));
        }

        function buildRuleTable(ruleNumber) {
            const rule = clampToInt(ruleNumber, 0, 255, 30);
            const binary = rule.toString(2).padStart(8, '0');
            const table = [];
            for (let i = 0; i < 8; i++) {
                table[7 - i] = parseInt(binary[i], 10);
            }
            return table;
        }

        function getNextState(left, center, right) {
            const index = (left << 2) | (center << 1) | right;
            return ruleTable[index] || 0;
        }

        function computeNextGeneration(current, wrap) {
            const width = current.length;
            const next = new Array(width);

            for (let i = 0; i < width; i++) {
                const left = wrap
                    ? current[(i - 1 + width) % width]
                    : (i > 0 ? current[i - 1] : 0);
                const center = current[i];
                const right = wrap
                    ? current[(i + 1) % width]
                    : (i < width - 1 ? current[i + 1] : 0);

                next[i] = getNextState(left, center, right);
            }

            return next;
        }

        function regenerate(options = {}) {
            const width = Math.floor(settings.canvasWidth / settings.cellSize);

            ruleTable = buildRuleTable(settings.rule);

            const patternGen = INITIAL_PATTERNS[settings.initialPattern];
            if (patternGen && typeof patternGen.generate === 'function') {
                currentGeneration = patternGen.generate(width);
            } else {
                currentGeneration = new Array(width).fill(0);
                currentGeneration[Math.floor(width / 2)] = 1;
            }

            grid = [currentGeneration.slice()];

            stats.generation = 0;
            stats.totalCells = width;
            stats.aliveCells = currentGeneration.reduce((sum, cell) => sum + cell, 0);

            if (!options.silent && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ca-regenerated', {
                    detail: {
                        stats: {...stats},
                        settings: getSettingsSnapshot()
                    }
                }));
            }

            return grid;
        }

        function stepGeneration(options = {}) {
            if (!currentGeneration || currentGeneration.length === 0) {
                return null;
            }

            const next = computeNextGeneration(currentGeneration, settings.wraparound);
            currentGeneration = next;
            grid.push(next.slice());

            stats.generation++;
            stats.aliveCells = next.reduce((sum, cell) => sum + cell, 0);

            if (!options.silent && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ca-step', {
                    detail: {
                        generation: stats.generation,
                        stats: {...stats}
                    }
                }));
            }

            return next;
        }

        function applyPreset(key, options = {}) {
            const preset = PRESETS[key];
            settings.presetKey = preset ? key : 'custom';

            assignTemplate(baseTemplate);
            if (preset && preset.settings) {
                assignTemplate(preset.settings, {skipMissing: true});
            }

            if (!options.skipRegenerate) {
                regenerate({silent: options.silent});
            }

            if (!options.silent && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ca-preset-change', {
                    detail: {
                        key: settings.presetKey,
                        settings: getSettingsSnapshot()
                    }
                }));
            }
        }

        function assignTemplate(source, {skipMissing = false} = {}) {
            if (!source) {
                return;
            }

            const keys = [
                'rule', 'cellSize', 'initialPattern', 'wraparound',
                'colorScheme', 'hue', 'backgroundColor', 'cellColor', 'animationSpeed'
            ];

            for (const key of keys) {
                if (skipMissing && !Object.prototype.hasOwnProperty.call(source, key)) {
                    continue;
                }

                switch (key) {
                    case 'backgroundColor':
                    case 'cellColor':
                        settings[key] = normalizeColor(source[key], baseTemplate[key]);
                        break;
                    default:
                        if (Object.prototype.hasOwnProperty.call(source, key)) {
                            settings[key] = source[key];
                        } else if (!skipMissing) {
                            settings[key] = baseTemplate[key];
                        }
                        break;
                }
            }
        }

        function setSettings(patch) {
            if (!patch) {
                return;
            }

            if (Object.prototype.hasOwnProperty.call(patch, 'rule')) {
                settings.rule = clampToInt(patch.rule, 0, 255, settings.rule);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'cellSize')) {
                settings.cellSize = clampToInt(patch.cellSize, 1, 20, settings.cellSize);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'initialPattern')) {
                settings.initialPattern = String(patch.initialPattern || 'single');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'wraparound')) {
                settings.wraparound = Boolean(patch.wraparound);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'colorScheme')) {
                settings.colorScheme = String(patch.colorScheme || 'classic');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'hue')) {
                settings.hue = clampToInt(patch.hue, 0, 360, settings.hue);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'animationSpeed')) {
                settings.animationSpeed = clampToInt(patch.animationSpeed, 1, 120, settings.animationSpeed);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'backgroundColor')) {
                settings.backgroundColor = normalizeColor(patch.backgroundColor, settings.backgroundColor);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'cellColor')) {
                settings.cellColor = normalizeColor(patch.cellColor, settings.cellColor);
            }

            settings.presetKey = 'custom';
        }

        function getPresetLabel(key) {
            return PRESETS[key]?.label || 'カスタム';
        }

        function getSettingsSnapshot() {
            return {
                rule: settings.rule,
                cellSize: settings.cellSize,
                initialPattern: settings.initialPattern,
                wraparound: settings.wraparound,
                colorScheme: settings.colorScheme,
                hue: settings.hue,
                backgroundColor: [...settings.backgroundColor],
                cellColor: [...settings.cellColor],
                animationSpeed: settings.animationSpeed,
                presetKey: settings.presetKey
            };
        }

        function getRuleBinary() {
            return settings.rule.toString(2).padStart(8, '0');
        }

        function getRuleNeighborhoods() {
            const binary = getRuleBinary();
            return [
                {pattern: '111', result: parseInt(binary[0], 10)},
                {pattern: '110', result: parseInt(binary[1], 10)},
                {pattern: '101', result: parseInt(binary[2], 10)},
                {pattern: '100', result: parseInt(binary[3], 10)},
                {pattern: '011', result: parseInt(binary[4], 10)},
                {pattern: '010', result: parseInt(binary[5], 10)},
                {pattern: '001', result: parseInt(binary[6], 10)},
                {pattern: '000', result: parseInt(binary[7], 10)}
            ];
        }

        return {
            settings,
            stats,
            aspectRatio: ASPECT_RATIO,
            getGrid: () => grid,
            getCurrentGeneration: () => currentGeneration.slice(),
            getStats: () => ({...stats}),
            regenerate,
            stepGeneration,
            applyPreset,
            setSettings,
            getPresetLabel,
            getSettingsSnapshot,
            getRuleBinary,
            getRuleNeighborhoods,
            presets: PRESETS,
            initialPatterns: INITIAL_PATTERNS
        };
    }

    window.CellularAutomatonEngine = {
        create: createCellularAutomatonEngine
    };
})();
