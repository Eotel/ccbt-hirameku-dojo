(() => {
    const PRESETS = {
        rule30: {
            label: 'ルール 30 — カオス',
            description: '最も有名なカオス的セルオートマトン。中央の1セルから始めると、左右に複雑なパターンが広がっていきます。ランダムに見えますが完全に決定論的です。',
            settings: {
                rule: 30,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'single',
                wraparound: false,
                colorScheme: 'classic',
                hue: 220,
                backgroundColor: [245, 248, 252],
                cellColor: [30, 41, 59],
                animationSpeed: 30
            }
        },
        rule90: {
            label: 'ルール 90 — フラクタル',
            description: 'シェルピンスキーの三角形と同じ形を作る美しいフラクタルルール。対称的で予測可能なパターンが延々と続きます。',
            settings: {
                rule: 90,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'single',
                wraparound: false,
                colorScheme: 'gradient',
                hue: 280,
                backgroundColor: [250, 248, 255],
                cellColor: [88, 28, 135],
                animationSpeed: 30
            }
        },
        rule110: {
            label: 'ルール 110 — チューリング完全',
            description: '計算理論的に最も重要なルール。チューリング完全であることが証明されており、どんな計算も実行できる能力を持ちます。',
            settings: {
                rule: 110,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'random-sparse',
                wraparound: false,
                colorScheme: 'gradient',
                hue: 160,
                backgroundColor: [240, 253, 244],
                cellColor: [6, 78, 59],
                animationSpeed: 30
            }
        },
        rule150: {
            label: 'ルール 150 — 対称な織物',
            description: '完全に対称的なパターンを生成するルール。織物やタイルのような規則的な模様が美しく展開します。',
            settings: {
                rule: 150,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'single',
                wraparound: false,
                colorScheme: 'gradient',
                hue: 30,
                backgroundColor: [255, 251, 235],
                cellColor: [120, 53, 15],
                animationSpeed: 30
            }
        },
        rule184: {
            label: 'ルール 184 — 交通流',
            description: '交通流のシミュレーションモデルとして使われるルール。車の流れのような動きが観察できます。',
            settings: {
                rule: 184,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'random-dense',
                wraparound: true,
                colorScheme: 'gradient',
                hue: 0,
                backgroundColor: [254, 242, 242],
                cellColor: [127, 29, 29],
                animationSpeed: 20
            }
        },
        rule54: {
            label: 'ルール 54 — 成長と消失',
            description: '成長と消失を繰り返すパターン。有機的な構造が現れては消える様子を観察できます。',
            settings: {
                rule: 54,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'random-sparse',
                wraparound: true,
                colorScheme: 'gradient',
                hue: 45,
                backgroundColor: [255, 247, 237],
                cellColor: [146, 64, 14],
                animationSpeed: 25
            }
        },
        rule126: {
            label: 'ルール 126 — 複雑な幾何学',
            description: 'カオスと秩序の境界にあるルール。三角形と複雑なパターンが混在する興味深い構造を作ります。',
            settings: {
                rule: 126,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'single',
                wraparound: false,
                colorScheme: 'rainbow',
                hue: 200,
                backgroundColor: [236, 254, 255],
                cellColor: [8, 51, 68],
                animationSpeed: 30
            }
        },
        rule182: {
            label: 'ルール 182 — 対称カオス',
            description: 'カオス的だが対称性も持つ不思議なルール。予測不可能な動きの中に規則性が見え隠れします。',
            settings: {
                rule: 182,
                cellSize: 4,
                cellShape: 'square',
                initialPattern: 'single',
                wraparound: false,
                colorScheme: 'gradient',
                hue: 320,
                backgroundColor: [253, 242, 248],
                cellColor: [131, 24, 67],
                animationSpeed: 30
            }
        }
    };

    const DEFAULT_PRESET_KEY = 'rule30';

    const BASE_TEMPLATE = {
        rule: 30,
        cellSize: 4,
        cellShape: 'square',
        initialPattern: 'single',
        wraparound: false,
        colorScheme: 'classic',
        hue: 220,
        backgroundColor: [245, 248, 252],
        cellColor: [30, 41, 59],
        animationSpeed: 30
    };

    const ASPECT_RATIO = 4 / 3;

    // カラースキーム定義
    // 参加者が自分でスキームを追加できます！
    // 色の返し方は3種類:
    // 1. RGB: {r: 0-255, g: 0-255, b: 0-255}
    // 2. HSB: {h: 0-360, s: 0-100, b: 0-100, mode: 'hsb'}
    // 3. HEX: {hex: '#FF5733'}
    const COLOR_SCHEMES = {
        classic: {
            label: 'クラシック（固定色）',
            description: 'セル色（固定）で設定した色を使用',
            compute: (generation, maxGen, settings) => {
                // settings.cellColor を RGB として返す
                const c = settings.cellColor || [30, 41, 59];
                return {r: c[0], g: c[1], b: c[2]};
            }
        },
        gradient: {
            label: 'グラデーション',
            description: '色相を基準に、世代ごとに明度が変化',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = settings.hue || 220;
                const sat = 70;
                const brightness = 100 - progress * 60; // 100 → 40
                return {h: hue, s: sat, b: brightness, mode: 'hsb'};
            }
        },
        rainbow: {
            label: 'レインボー',
            description: '色相を基準に、世代ごとに色相が変化',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const baseHue = settings.hue || 220;
                const hue = (baseHue + progress * 360) % 360;
                return {h: hue, s: 80, b: 80, mode: 'hsb'};
            }
        },
        warm: {
            label: 'ウォーム',
            description: '暖色系（赤→オレンジ→黄）のグラデーション',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = 0 + progress * 60; // 0 (赤) → 60 (黄)
                return {h: hue, s: 90, b: 85, mode: 'hsb'};
            }
        },
        cool: {
            label: 'クール',
            description: '寒色系（青→緑→シアン）のグラデーション',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = 240 - progress * 60; // 240 (青) → 180 (シアン)
                return {h: hue, s: 80, b: 75, mode: 'hsb'};
            }
        },
        fire: {
            label: 'ファイア',
            description: '炎のような赤→オレンジ→黄のグラデーション（明度も変化）',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = progress * 50; // 0 (赤) → 50 (オレンジ〜黄)
                const brightness = 60 + progress * 40; // 60 → 100
                return {h: hue, s: 100, b: brightness, mode: 'hsb'};
            }
        },
        ocean: {
            label: 'オーシャン',
            description: '海のような深い青から明るいシアンへ',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = 200 - progress * 20; // 200 → 180
                const brightness = 40 + progress * 50; // 40 → 90
                return {h: hue, s: 85, b: brightness, mode: 'hsb'};
            }
        },
        forest: {
            label: 'フォレスト',
            description: '森のような深緑から明るい黄緑へ',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = 120 + progress * 30; // 120 (緑) → 150 (黄緑)
                const brightness = 35 + progress * 55; // 35 → 90
                return {h: hue, s: 80, b: brightness, mode: 'hsb'};
            }
        },
        sunset: {
            label: 'サンセット',
            description: '夕焼けのような紫→ピンク→オレンジ',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = 280 + progress * 60; // 280 (紫) → 340 (ピンク) → 40 (オレンジ)
                return {h: hue % 360, s: 85, b: 80, mode: 'hsb'};
            }
        },
        monochrome: {
            label: 'モノクローム',
            description: '黒→グレー→白のグレースケール',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const value = Math.floor(progress * 255); // 0 → 255
                return {r: value, g: value, b: value};
            }
        },
        neon: {
            label: 'ネオン',
            description: '鮮やかなネオンカラーが虹色に変化',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const hue = (progress * 360) % 360;
                return {h: hue, s: 100, b: 95, mode: 'hsb'};
            }
        },
        retro: {
            label: 'レトロ（16進数例）',
            description: '16進数カラーコードを使った例（ピンク→緑）',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                // ピンク系から緑系への変化
                const colors = ['#FF1493', '#FF69B4', '#FFB6C1', '#98FB98', '#00FA9A', '#00FF7F'];
                const index = Math.floor(progress * (colors.length - 1));
                return {hex: colors[index]};
            }
        },
        cyberpunk: {
            label: 'サイバーパンク（16進数）',
            description: 'サイバーパンク風の紫→ピンク→青',
            compute: (generation, maxGen, settings) => {
                const progress = maxGen > 1 ? generation / (maxGen - 1) : 0;
                const colors = ['#8B00FF', '#9D00FF', '#B300FF', '#FF00FF', '#FF1493', '#00BFFF', '#00CED1'];
                const index = Math.floor(progress * (colors.length - 1));
                return {hex: colors[index]};
            }
        }
    };

    const INITIAL_PATTERNS = {
        single: {
            label: '中央の1セル', generate: (width) => {
                const cells = new Array(width).fill(0);
                cells[Math.floor(width / 2)] = 1;
                return cells;
            }
        },
        'random-sparse': {
            label: 'ランダム(疎)', generate: (width) => {
                return Array.from({length: width}, () => Math.random() < 0.1 ? 1 : 0);
            }
        },
        'random-dense': {
            label: 'ランダム(密)', generate: (width) => {
                return Array.from({length: width}, () => Math.random() < 0.5 ? 1 : 0);
            }
        },
        'alternating': {
            label: '交互パターン', generate: (width) => {
                return Array.from({length: width}, (_, i) => i % 2);
            }
        },
        'symmetric': {
            label: '対称パターン', generate: (width) => {
                const half = Math.floor(width / 2);
                const cells = new Array(width).fill(0);
                cells[half] = 1;
                if (half - 3 >= 0) cells[half - 3] = 1;
                if (half + 3 < width) cells[half + 3] = 1;
                return cells;
            }
        }
    };

    window.CellularAutomatonConfig = {
        PRESETS,
        DEFAULT_PRESET_KEY,
        BASE_TEMPLATE,
        ASPECT_RATIO,
        INITIAL_PATTERNS,
        COLOR_SCHEMES
    };
})();
