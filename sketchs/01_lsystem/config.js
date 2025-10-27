(() => {
    const PRESETS = {
        spreadingTree: {
            label: '広がる大きな木',
            description: 'まっすぐな幹から左右に枝が広がる木。「FF+[+F-F-F]-[-F+F+F]」のルールで左右のバランスがとれた形になります。',
            settings: {
                axiom: 'F',
                rules: {
                    F: 'FF+[+F-F-F]-[-F+F+F]'
                },
                iterations: 5,
                turnAngle: 24,
                stepLength: 9,
                stepDecay: 0.78,
                widthDecay: 0.72,
                baseBranchWidth: 9,
                colorize: true,
                baseHue: 118,
                hueStep: 6,
                branchColor: [96, 70, 40],
                backgroundColor: [238, 247, 255],
                initialRotation: 0,
                origin: {x: 0.5, y: 0.94}
            }
        },
        detailedPlant: {
            label: 'こまかい葉っぱの植物',
            description: '葉っぱがたくさん重なってふわふわした植物。XとFの2つのルールを組み合わせて、細かい枝をたくさん作ります。',
            settings: {
                axiom: 'X',
                rules: {
                    X: 'F+[[X]-X]-F[-FX]+X',
                    F: 'FF'
                },
                iterations: 6,
                turnAngle: 28,
                stepLength: 7,
                stepDecay: 0.88,
                widthDecay: 0.72,
                baseBranchWidth: 7,
                colorize: true,
                baseHue: 110,
                hueStep: 8,
                branchColor: [92, 70, 40],
                backgroundColor: [232, 246, 243],
                initialRotation: 0,
                origin: {x: 0.48, y: 0.96}
            }
        },
        alternatingTree: {
            label: '交互に枝が出る木',
            description: '右と左に交互に枝が生える木。「F[+F]F[-F]F」のルールで、幹の違う高さから右→左の順番で枝が出ます。',
            settings: {
                axiom: 'F',
                rules: {
                    F: 'F[+F]F[-F]F'
                },
                iterations: 5,
                turnAngle: 22,
                stepLength: 4,
                stepDecay: 0.8,
                widthDecay: 0.68,
                baseBranchWidth: 8,
                colorize: false,
                branchColor: [72, 60, 52],
                backgroundColor: [241, 248, 255],
                initialRotation: 0,
                origin: {x: 0.5, y: 0.94}
            }
        },
        denseTree: {
            label: '茂った木',
            description: '右・左・上の3方向に枝が出る茂った木。「F[+F]F[-F][F]」のルールで、最後の「[F]」がまっすぐ上に伸びる枝を作り、密度の高い樹形になります。',
            settings: {
                axiom: 'F',
                rules: {
                    F: 'F[+F]F[-F][F]'
                },
                iterations: 6,
                turnAngle: 23,
                stepLength: 11,
                stepDecay: 0.76,
                widthDecay: 0.70,
                baseBranchWidth: 9,
                colorize: true,
                baseHue: 105,
                hueStep: 8,
                branchColor: [85, 68, 45],
                backgroundColor: [243, 249, 246],
                initialRotation: 0,
                origin: {x: 0.5, y: 0.94}
            }
        },
        symmetricTree: {
            label: '左右対称の木',
            description: '同じ位置から左右に同じ枝が出る木。「F[+F][-F]F」のルールで、ひとつの点から左右の枝が一緒に生えます。',
            settings: {
                axiom: 'F',
                rules: {
                    F: 'F[+F][-F]F'
                },
                iterations: 6,
                turnAngle: 25,
                stepLength: 10,
                stepDecay: 0.78,
                widthDecay: 0.70,
                baseBranchWidth: 3,
                colorize: true,
                baseHue: 90,
                hueStep: 7,
                branchColor: [80, 65, 45],
                backgroundColor: [245, 250, 248],
                initialRotation: 0,
                origin: {x: 0.5, y: 0.94}
            }
        },
        randomBush: {
            label: '毎回ちがう形の水草',
            description: '同じ設定でも毎回ちがう形になる水草。2つのルールを半分ずつの確率で切り替えて、やわらかく揺れる水草の束を描きます。',
            settings: {
                axiom: 'F',
                rules: {
                    F: [
                        {value: 'FF-[-F+F+F]+[+F-F-F]', weight: 0.5},
                        {value: 'FF+[+F-F]-[-F+F]', weight: 0.5}
                    ]
                },
                iterations: 5,
                turnAngle: 24,
                stepLength: 8,
                stepDecay: 0.83,
                widthDecay: 0.74,
                baseBranchWidth: 7,
                colorize: true,
                baseHue: 112,
                hueStep: 10,
                branchColor: [90, 70, 42],
                backgroundColor: [226, 244, 235],
                initialRotation: 0,
                origin: {x: 0.5, y: 0.96}
            }
        },
        fractalTree: {
            label: 'フラクタルツリー',
            description: '完全に左右対称の二分木。「F[+F][-F]」のルールで、各枝から同じ角度で2本ずつ枝が分かれる典型的なフラクタル構造です。',
            settings: {
                axiom: 'F',
                rules: {
                    F: 'F[+F][-F]'
                },
                iterations: 7,
                turnAngle: 25.7,
                stepLength: 100,
                stepDecay: 0.8,
                widthDecay: 0.75,
                baseBranchWidth: 6,
                colorize: false,
                branchColor: [40, 40, 40],
                backgroundColor: [250, 250, 250],
                initialRotation: 0,
                origin: {x: 0.5, y: 0.95}
            }
        },
        snowCrystal: {
            label: '雪の結晶',
            description: '雪の結晶のような形。「F+F--F+F」で直線を山型に変えていくと、ギザギザが増えて本物の雪みたいになります。',
            settings: {
                axiom: 'F--F--F',
                rules: {
                    F: 'F+F--F+F'
                },
                iterations: 4,
                turnAngle: 60,
                stepLength: 9,
                stepDecay: 1,
                widthDecay: 1,
                baseBranchWidth: 2,
                colorize: false,
                branchColor: [24, 66, 128],
                backgroundColor: [245, 249, 255],
                initialRotation: -90,
                origin: {x: 0.75, y: 0.3}
            }
        },
        trianglePattern: {
            label: '三角形のもよう',
            description: '三角形の中に小さな三角形がたくさん入っているもよう。Aのルール「A→B-A-B」とBのルール「B→A+B+A」で左右の折り返しを重ね、段々と細かく分割されたシェルピンスキー三角形を描きます。AとBはいずれも前進命令として扱います。',
            settings: {
                axiom: 'A',
                rules: {
                    A: 'B-A-B',
                    B: 'A+B+A'
                },
                iterations: 7,
                turnAngle: 60,
                stepLength: 9,
                stepDecay: 1,
                widthDecay: 1,
                baseBranchWidth: 1.6,
                colorize: false,
                branchColor: [36, 68, 110],
                backgroundColor: [248, 250, 252],
                initialRotation: -30,
                origin: {x: 0.9, y: 0.9}
            }
        },
        dragonCurve: {
            label: 'ドラゴン曲線',
            description: '紙を何度も半分に折って開いたときにできる形。XとYのルールで右折と左折をくり返して、くねくねと複雑に曲がる線を描きます。',
            settings: {
                axiom: 'FX',
                rules: {
                    X: 'X+YF+',
                    Y: '-FX-Y'
                },
                iterations: 13,
                turnAngle: 90,
                stepLength: 8,
                stepDecay: 1,
                widthDecay: 0.95,
                baseBranchWidth: 2.5,
                colorize: true,
                baseHue: 200,
                hueStep: 12,
                branchColor: [40, 40, 40],
                backgroundColor: [245, 247, 250],
                initialRotation: 90,
                origin: {x: 0.8, y: 0.65}
            }
        }
    };

    const DEFAULT_PRESET_KEY = 'fractalTree';

    const BASE_TEMPLATE = {
        axiom: 'F',
        rules: {
            F: 'F'
        },
        iterations: 4,
        turnAngle: 25,
        stepLength: 8,
        stepDecay: 0.75,
        widthDecay: 0.7,
        baseBranchWidth: 10,
        colorize: true,
        baseHue: 120,
        hueStep: 5,
        branchColor: [96, 70, 40],
        backgroundColor: [240, 248, 255],
        initialRotation: 0,
        origin: {x: 0.5, y: 0.92}
    };

    const ASPECT_RATIO = 4 / 3;

    window.LSystemConfig = {
        PRESETS,
        DEFAULT_PRESET_KEY,
        BASE_TEMPLATE,
        ASPECT_RATIO
    };
})();
