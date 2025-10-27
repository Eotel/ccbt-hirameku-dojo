(() => {
    function createLSystemEngine({config, utils}) {
        if (!config) {
            throw new Error('LSystemConfig が読み込まれていません');
        }
        if (!utils) {
            throw new Error('Utils が読み込まれていません');
        }

        const {
            PRESETS = {}, DEFAULT_PRESET_KEY = 'canopyTree', BASE_TEMPLATE = {}, ASPECT_RATIO = 4 / 3
        } = config;

        const {
            clampNumber, clampToInt, normalizeColor, normalizeOrigin, pickWeighted, deepClone
        } = utils;

        const baseTemplate = deepClone ? deepClone(BASE_TEMPLATE) : structuredCloneFallback(BASE_TEMPLATE);

        const settings = {
            canvasWidth: 800,
            canvasHeight: 600,
            presetKey: DEFAULT_PRESET_KEY,
            axiom: baseTemplate.axiom ?? 'F',
            rules: cloneRules(baseTemplate.rules ?? {F: 'F'}),
            iterations: baseTemplate.iterations ?? 4,
            turnAngle: baseTemplate.turnAngle ?? 25,
            stepLength: baseTemplate.stepLength ?? 8,
            stepDecay: baseTemplate.stepDecay ?? 0.75,
            widthDecay: baseTemplate.widthDecay ?? 0.7,
            baseBranchWidth: baseTemplate.baseBranchWidth ?? 10,
            colorize: baseTemplate.colorize ?? true,
            baseHue: baseTemplate.baseHue ?? 120,
            hueStep: baseTemplate.hueStep ?? 5,
            branchColor: [...(baseTemplate.branchColor ?? [96, 70, 40])],
            backgroundColor: [...(baseTemplate.backgroundColor ?? [240, 248, 255])],
            initialRotation: baseTemplate.initialRotation ?? 0,
            origin: {...(baseTemplate.origin ?? {x: 0.5, y: 0.92})}
        };

        const stats = {
            branchCount: 0, symbolCount: 0, expandTimeMs: null
        };

        let sentence = '';

        function structuredCloneFallback(source) {
            return JSON.parse(JSON.stringify(source ?? {}));
        }

        function regenerate(options = {}) {
            const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
            sentence = expandSentence(settings.axiom, settings.rules, settings.iterations);
            const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
            stats.branchCount = 0;
            stats.symbolCount = sentence.length;
            stats.expandTimeMs = Math.round(end - start);

            if (!options.silent && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('lsystem-regenerated', {
                    detail: {
                        sentence, stats: {...stats}, settings: getSettingsSnapshot()
                    }
                }));
            }

            return sentence;
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
                window.dispatchEvent(new CustomEvent('lsystem-preset-change', {
                    detail: {
                        key: settings.presetKey, settings: getSettingsSnapshot()
                    }
                }));
            }
        }

        function assignTemplate(source, {skipMissing = false} = {}) {
            if (!source) {
                return;
            }

            const keys = ['axiom', 'rules', 'iterations', 'turnAngle', 'stepLength', 'stepDecay', 'widthDecay', 'baseBranchWidth', 'colorize', 'baseHue', 'hueStep', 'branchColor', 'backgroundColor', 'initialRotation', 'origin'];

            for (const key of keys) {
                if (skipMissing && !Object.prototype.hasOwnProperty.call(source, key)) {
                    continue;
                }

                switch (key) {
                    case 'rules':
                        settings.rules = cloneRules(source.rules);
                        break;
                    case 'branchColor':
                    case 'backgroundColor':
                        settings[key] = normalizeColor(source[key], baseTemplate[key]);
                        break;
                    case 'origin':
                        settings.origin = normalizeOrigin(source.origin, baseTemplate.origin);
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

            if (Object.prototype.hasOwnProperty.call(patch, 'axiom')) {
                settings.axiom = String(patch.axiom || 'F');
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'iterations')) {
                settings.iterations = clampToInt(patch.iterations, 1, 20, settings.iterations);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'turnAngle')) {
                settings.turnAngle = clampNumber(patch.turnAngle, 0, 360, settings.turnAngle);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'stepLength')) {
                settings.stepLength = clampNumber(patch.stepLength, 1, 160, settings.stepLength);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'stepDecay')) {
                settings.stepDecay = clampNumber(patch.stepDecay, 0.3, 1.2, settings.stepDecay);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'widthDecay')) {
                settings.widthDecay = clampNumber(patch.widthDecay, 0.2, 1.1, settings.widthDecay);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'baseBranchWidth')) {
                settings.baseBranchWidth = clampNumber(patch.baseBranchWidth, 1, 40, settings.baseBranchWidth);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'colorize')) {
                settings.colorize = Boolean(patch.colorize);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'baseHue')) {
                settings.baseHue = clampToInt(patch.baseHue, 0, 360, settings.baseHue);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'hueStep')) {
                settings.hueStep = clampToInt(patch.hueStep, 0, 120, settings.hueStep);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'initialRotation')) {
                settings.initialRotation = clampNumber(patch.initialRotation, -360, 360, settings.initialRotation);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'origin')) {
                settings.origin = normalizeOrigin(patch.origin, settings.origin);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'rules')) {
                settings.rules = cloneRules(patch.rules);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'backgroundColor')) {
                settings.backgroundColor = normalizeColor(patch.backgroundColor, settings.backgroundColor);
            }
            if (Object.prototype.hasOwnProperty.call(patch, 'branchColor')) {
                settings.branchColor = normalizeColor(patch.branchColor, settings.branchColor);
            }

            settings.presetKey = 'custom';
        }

        function setRule(symbol, expansion) {
            if (!symbol) {
                return;
            }
            if (!settings.rules) {
                settings.rules = {};
            }

            const key = String(symbol).trim().charAt(0);
            if (!key) {
                return;
            }

            const normalized = normalizeRuleDefinition(expansion);
            if (Array.isArray(normalized) || typeof normalized === 'string') {
                settings.rules[key] = normalized;
            } else {
                settings.rules[key] = '';
            }

            settings.presetKey = 'custom';
        }

        function setRules(nextRules) {
            if (!nextRules) {
                return;
            }
            settings.rules = cloneRules(nextRules);
            settings.presetKey = 'custom';
        }

        function updateBranchCount(count) {
            stats.branchCount = count;
        }

        function expandSentence(axiom, rules, iterations) {
            let current = axiom;
            for (let i = 0; i < iterations; i++) {
                const builder = new Array(current.length);
                let pointer = 0;
                for (let index = 0; index < current.length; index++) {
                    const symbol = current[index];
                    const rule = rules[symbol];
                    if (!rule) {
                        builder[pointer++] = symbol;
                    } else if (typeof rule === 'string') {
                        builder[pointer++] = rule;
                    } else if (Array.isArray(rule)) {
                        builder[pointer++] = pickWeighted(rule) ?? symbol;
                    } else {
                        builder[pointer++] = symbol;
                    }
                }
                builder.length = pointer;
                current = builder.join('');
            }
            return current;
        }

        function cloneRules(rules) {
            const clone = {};
            if (!rules) {
                return clone;
            }
            for (const [symbol, expansion] of Object.entries(rules)) {
                const normalized = normalizeRuleDefinition(expansion);
                if (Array.isArray(normalized)) {
                    clone[symbol] = normalized.map((entry) => typeof entry === 'string' ? entry : {
                        value: entry.value, weight: entry.weight
                    });
                } else if (typeof normalized === 'string') {
                    clone[symbol] = normalized;
                } else {
                    clone[symbol] = '';
                }
            }
            return clone;
        }

        function normalizeRuleDefinition(definition) {
            if (Array.isArray(definition)) {
                const normalizedList = definition
                    .map((entry) => normalizeRuleOption(entry))
                    .filter((entry) => entry !== null);
                return finalizeRuleList(normalizedList);
            }

            const normalizedSingle = normalizeRuleOption(definition);
            if (normalizedSingle === null) {
                return '';
            }
            if (typeof normalizedSingle === 'string') {
                return normalizedSingle;
            }
            return [normalizedSingle];
        }

        function finalizeRuleList(list) {
            if (list.length === 0) {
                return '';
            }
            if (list.length === 1) {
                const single = list[0];
                return typeof single === 'string' ? single : [single];
            }
            return list.map((entry) => (typeof entry === 'string' ? entry : {
                value: entry.value, weight: entry.weight
            }));
        }

        function normalizeRuleOption(option) {
            if (typeof option === 'string') {
                const text = option.trim();
                return text.length ? text : null;
            }
            if (!option || typeof option.value !== 'string') {
                return null;
            }
            const value = option.value.trim();
            if (!value) {
                return null;
            }
            const weightRaw = option.weight;
            const weight = Number.isFinite(weightRaw) ? weightRaw : Number(weightRaw);
            const normalizedWeight = Number.isFinite(weight) ? weight : 1;
            return {value, weight: normalizedWeight};
        }

        function getPresetLabel(key) {
            return PRESETS[key]?.label || 'カスタム';
        }

        function getSettingsSnapshot() {
            return {
                axiom: settings.axiom,
                rules: cloneRules(settings.rules),
                iterations: settings.iterations,
                turnAngle: settings.turnAngle,
                stepLength: settings.stepLength,
                stepDecay: settings.stepDecay,
                widthDecay: settings.widthDecay,
                baseBranchWidth: settings.baseBranchWidth,
                colorize: settings.colorize,
                baseHue: settings.baseHue,
                hueStep: settings.hueStep,
                branchColor: [...settings.branchColor],
                backgroundColor: [...settings.backgroundColor],
                initialRotation: settings.initialRotation,
                origin: {...settings.origin},
                presetKey: settings.presetKey
            };
        }

        function ruleControlKey(symbol) {
            return `rule_${symbol}`;
        }

        function serializeRule(expansion) {
            if (Array.isArray(expansion)) {
                return expansion
                    .map((entry) => {
                        if (typeof entry === 'string') {
                            return entry;
                        }
                        if (entry && typeof entry.value === 'string') {
                            const weight = typeof entry.weight === 'number' ? entry.weight : 1;
                            return `${entry.value} | ${weight}`;
                        }
                        return '';
                    })
                    .filter(Boolean)
                    .join(' ; ');
            }
            if (typeof expansion === 'string') {
                return expansion;
            }
            return '';
        }

        function parseRuleInput(value) {
            const raw = String(value ?? '').trim();
            if (!raw) {
                return '';
            }

            if (!raw.includes(';') && !raw.includes('|')) {
                return raw;
            }

            const options = raw
                .split(';')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((part) => {
                    const [pattern, weightRaw] = part.split('|').map((chunk) => chunk.trim());
                    if (!pattern) {
                        return null;
                    }
                    if (weightRaw) {
                        const weight = Number(weightRaw);
                        return {
                            value: pattern, weight: Number.isFinite(weight) ? weight : 1
                        };
                    }
                    return {
                        value: pattern, weight: 1
                    };
                })
                .filter(Boolean);

            if (options.length === 0) {
                return raw;
            }

            if (options.length === 1 && options[0].weight === 1) {
                return options[0].value;
            }

            return options;
        }

        return {
            settings,
            stats,
            aspectRatio: ASPECT_RATIO,
            getSentence: () => sentence,
            getStats: () => ({...stats}),
            regenerate,
            applyPreset,
            setSettings,
            setRule,
            setRules,
            updateBranchCount,
            getPresetLabel,
            getSettingsSnapshot,
            cloneRules,
            parseRuleInput,
            serializeRule,
            ruleControlKey,
            presets: PRESETS
        };
    }

    window.LSystemEngine = {
        create: createLSystemEngine
    };
})();
