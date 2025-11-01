const Shapes = (() => {
    const DEFAULT_ROTATION = 0;

    function getContext(p) {
        if (p && typeof p === 'object') {
            return p;
        }
        if (typeof window !== 'undefined') {
            return window;
        }
        throw new Error('Shapes: p5 context is not available');
    }

    function normalizeNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function applyStyles(ctx, options = {}) {
        const {fill, stroke, strokeWeight, strokeCap, strokeJoin, noFill, noStroke} = options;

        if (noFill || fill === null || fill === false) {
            ctx.noFill();
        } else if (fill !== undefined) {
            if (Array.isArray(fill)) {
                ctx.fill(...fill);
            } else {
                ctx.fill(fill);
            }
        }

        if (noStroke || stroke === null || stroke === false) {
            ctx.noStroke();
        } else if (stroke !== undefined) {
            if (Array.isArray(stroke)) {
                ctx.stroke(...stroke);
            } else {
                ctx.stroke(stroke);
            }
        }

        if (typeof strokeWeight === 'number') {
            ctx.strokeWeight(strokeWeight);
        }

        if (typeof strokeCap === 'string') {
            ctx.strokeCap(strokeCap);
        }

        if (typeof strokeJoin === 'string') {
            ctx.strokeJoin(strokeJoin);
        }
    }

    function applyTransform(ctx, options = {}) {
        const {x = 0, y = 0, rotation = DEFAULT_ROTATION, scale = 1} = options;

        ctx.translate(normalizeNumber(x), normalizeNumber(y));

        const angle = normalizeNumber(rotation, DEFAULT_ROTATION);
        if (angle !== 0) {
            ctx.rotate(angle);
        }

        if (Array.isArray(scale) && scale.length >= 2) {
            ctx.scale(normalizeNumber(scale[0], 1), normalizeNumber(scale[1], 1));
        } else {
            const uniform = normalizeNumber(scale, 1);
            if (uniform !== 1) {
                ctx.scale(uniform);
            }
        }
    }

    function withContext(ctx, options, drawFn) {
        ctx.push();
        applyStyles(ctx, options);
        applyTransform(ctx, options);
        drawFn();
        ctx.pop();
    }

    function resolveRadius(radius) {
        if (radius === undefined) {
            return [0, 0, 0, 0];
        }

        if (Array.isArray(radius)) {
            const [tl = 0, tr = 0, br = 0, bl = 0] = radius;
            return [normalizeNumber(tl), normalizeNumber(tr), normalizeNumber(br), normalizeNumber(bl)];
        }

        if (typeof radius === 'object') {
            const tl = radius.tl ?? radius.topLeft ?? 0;
            const tr = radius.tr ?? radius.topRight ?? 0;
            const br = radius.br ?? radius.bottomRight ?? 0;
            const bl = radius.bl ?? radius.bottomLeft ?? 0;
            return [normalizeNumber(tl), normalizeNumber(tr), normalizeNumber(br), normalizeNumber(bl)];
        }

        const r = normalizeNumber(radius, 0);
        return [r, r, r, r];
    }

    function drawCircle(ctx, options = {}) {
        const diameter = normalizeNumber(options.diameter ?? options.size ?? options.radius * 2, 50);
        withContext(ctx, options, () => {
            ctx.circle(0, 0, diameter);
        });
    }

    function drawSquare(ctx, options = {}) {
        const size = normalizeNumber(options.size ?? options.diameter ?? 50, 50);
        withContext(ctx, options, () => {
            ctx.rectMode(ctx.CENTER);
            ctx.square(0, 0, size, normalizeNumber(options.radius ?? options.cornerRadius, 0));
        });
    }

    function drawRect(ctx, options = {}) {
        const width = normalizeNumber(options.width ?? options.w ?? options.size ?? 50, 50);
        const height = normalizeNumber(options.height ?? options.h ?? options.size ?? 50, width);
        const [tl, tr, br, bl] = resolveRadius(options.radius ?? options.cornerRadius);
        withContext(ctx, options, () => {
            ctx.rectMode(ctx.CENTER);
            ctx.rect(0, 0, width, height, tl, tr, br, bl);
        });
    }

    function drawPolygon(ctx, options = {}) {
        const sides = Math.max(3, Math.round(normalizeNumber(options.sides ?? options.vertexNum ?? options.vertices, 3)));
        const diameter = normalizeNumber(options.diameter ?? options.size ?? 50, 50);
        const radius = diameter / 2;
        withContext(ctx, options, () => {
            ctx.beginShape();
            for (let i = 0; i < sides; i++) {
                const angle = (Math.PI * 2 * i) / sides;
                const px = radius * Math.cos(angle);
                const py = radius * Math.sin(angle);
                ctx.vertex(px, py);
            }
            ctx.endShape(ctx.CLOSE);
        });
    }

    function drawDiamond(ctx, options = {}) {
        const diameter = normalizeNumber(options.diameter ?? options.size ?? 50, 50);
        const aspectRatio = normalizeNumber(options.aspectRatio ?? options.ratio ?? 1, 1);
        const rx = diameter / 2;
        const ry = rx * aspectRatio;
        withContext(ctx, options, () => {
            ctx.beginShape();
            ctx.vertex(0, -ry);
            ctx.vertex(rx, 0);
            ctx.vertex(0, ry);
            ctx.vertex(-rx, 0);
            ctx.endShape(ctx.CLOSE);
        });
    }

    function drawTriangle(ctx, options = {}) {
        const diameter = normalizeNumber(options.diameter ?? options.size ?? 50, 50);
        const radius = diameter / 2;
        const offset = normalizeNumber(options.offsetAngle ?? options.offset ?? Math.PI / 6, Math.PI / 6);
        withContext(ctx, options, () => {
            ctx.beginShape();
            for (let i = 0; i < 3; i++) {
                const angle = offset + (Math.PI * 2 * i) / 3;
                const px = radius * Math.cos(angle);
                const py = radius * Math.sin(angle);
                ctx.vertex(px, py);
            }
            ctx.endShape(ctx.CLOSE);
        });
    }

    function drawStar(ctx, options = {}) {
        const spikes = Math.max(2, Math.round(normalizeNumber(options.spikes ?? options.prickleNum ?? 5, 5)));
        const outerDiameter = normalizeNumber(options.diameter ?? options.size ?? 50, 50);
        const innerScale = normalizeNumber(options.innerScale ?? options.innerRatio ?? 0.5, 0.5);
        const outerRadius = outerDiameter / 2;
        const innerRadius = outerRadius * innerScale;
        const totalVertices = spikes * 2;
        withContext(ctx, options, () => {
            ctx.beginShape();
            for (let i = 0; i < totalVertices; i++) {
                const useOuter = i % 2 === 0;
                const radius = useOuter ? outerRadius : innerRadius;
                const angle = (Math.PI * i) / spikes;
                ctx.vertex(radius * Math.cos(angle), radius * Math.sin(angle));
            }
            ctx.endShape(ctx.CLOSE);
        });
    }

    function drawLine(ctx, options = {}) {
        const length = normalizeNumber(options.length ?? options.size ?? 50, 50);
        const half = length / 2;
        withContext(ctx, options, () => {
            ctx.line(-half, -half, half, half);
        });
    }

    function create(p) {
        const ctx = getContext(p);
        return {
            circle: (opts) => drawCircle(ctx, opts),
            square: (opts) => drawSquare(ctx, opts),
            rect: (opts) => drawRect(ctx, opts),
            polygon: (opts) => drawPolygon(ctx, opts),
            diamond: (opts) => drawDiamond(ctx, opts),
            triangle: (opts) => drawTriangle(ctx, opts),
            star: (opts) => drawStar(ctx, opts),
            line: (opts) => drawLine(ctx, opts)
        };
    }

    return {
        create,
        circle: (opts) => drawCircle(getContext(), opts),
        square: (opts) => drawSquare(getContext(), opts),
        rect: (opts) => drawRect(getContext(), opts),
        polygon: (opts) => drawPolygon(getContext(), opts),
        diamond: (opts) => drawDiamond(getContext(), opts),
        triangle: (opts) => drawTriangle(getContext(), opts),
        star: (opts) => drawStar(getContext(), opts),
        line: (opts) => drawLine(getContext(), opts)
    };
})();
