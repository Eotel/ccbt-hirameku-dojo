const Utils = (() => {
    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        if (Number.isNaN(number)) {
            return fallback;
        }
        return Math.min(Math.max(number, min), max);
    }

    function clampToInt(value, min, max, fallback) {
        const integer = Math.round(Number(value));
        if (Number.isNaN(integer)) {
            return fallback;
        }
        return Math.min(Math.max(integer, min), max);
    }

    function normalizeColor(value, fallback) {
        const reference = Array.isArray(fallback) ? fallback : [0, 0, 0];
        if (!Array.isArray(value)) {
            return [...reference];
        }
        const [r, g, b] = value;
        return [
            clampNumber(r, 0, 255, reference[0] ?? 0),
            clampNumber(g, 0, 255, reference[1] ?? 0),
            clampNumber(b, 0, 255, reference[2] ?? 0)
        ];
    }

    function normalizeOrigin(origin, fallback = {x: 0.5, y: 0.5}) {
        const base = fallback || {x: 0.5, y: 0.5};
        if (!origin || typeof origin !== 'object') {
            return {...base};
        }
        const x = clampNumber(origin.x, -1, 2, base.x);
        const y = clampNumber(origin.y, -1, 2, base.y);
        return {x, y};
    }

    function pickWeighted(options) {
        const normalized = options
            .map((option) => {
                if (typeof option === 'string') {
                    return {value: option, weight: 1};
                }
                if (option && typeof option.value === 'string') {
                    const weight = typeof option.weight === 'number' ? option.weight : 1;
                    return {value: option.value, weight: Math.max(0, weight)};
                }
                return null;
            })
            .filter(Boolean);

        if (normalized.length === 0) {
            return '';
        }

        const total = normalized.reduce((sum, item) => sum + item.weight, 0);
        if (total <= 0) {
            return normalized[0].value;
        }

        const r = Math.random() * total;
        let accumulator = 0;
        for (const option of normalized) {
            accumulator += option.weight;
            if (r <= accumulator) {
                return option.value;
            }
        }
        return normalized[normalized.length - 1].value;
    }

    function lerpColorArray(c1, c2, amt) {
        const r = lerp(c1[0], c2[0], amt);
        const g = lerp(c1[1], c2[1], amt);
        const b = lerp(c1[2], c2[2], amt);
        return [r, g, b];
    }

    function deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) {
            const clonedArr = [];
            for (let i = 0; i < obj.length; i++) {
                clonedArr[i] = deepClone(obj[i]);
            }
            return clonedArr;
        }
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }

    function attachCanvas(canvas, containerIdOrElement = 'canvas-container') {
        if (typeof document === 'undefined') return;

        let container;
        if (typeof containerIdOrElement === 'string') {
            container = document.getElementById(containerIdOrElement);
        } else {
            container = containerIdOrElement;
        }

        if (container) {
            canvas.parent(container);
        } else {
            canvas.parent(document.body);
        }
    }

    function updateStatusPanel(htmlContent, panelId = 'status-panel') {
        if (typeof document === 'undefined') return;

        const panel = document.getElementById(panelId);
        if (!panel) return;

        panel.innerHTML = htmlContent;
    }

    function isMouseInBounds() {
        return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
    }

    function drawRoundedRect(x, y, w, h, r) {
        beginShape();
        vertex(x + r, y);
        vertex(x + w - r, y);
        quadraticVertex(x + w, y, x + w, y + r);
        vertex(x + w, y + h - r);
        quadraticVertex(x + w, y + h, x + w - r, y + h);
        vertex(x + r, y + h);
        quadraticVertex(x, y + h, x, y + h - r);
        vertex(x, y + r);
        quadraticVertex(x, y, x + r, y);
        endShape(CLOSE);
    }

    function drawOverlay(alpha = 80) {
        push();
        fill(0, 0, 0, alpha);
        noStroke();
        rect(0, 0, width, height);
        pop();
    }

    function formatNumber(num, decimals = 2) {
        return Number(num).toFixed(decimals);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function throttle(func, limit) {
        let lastFunc;
        let lastRan;
        return function (...args) {
            if (!lastRan) {
                func.apply(this, args);
                lastRan = Date.now();
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(function () {
                    if ((Date.now() - lastRan) >= limit) {
                        func.apply(this, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    function createPalette(baseHue, count = 5, saturation = 70, brightness = 80) {
        const palette = [];
        for (let i = 0; i < count; i++) {
            const hue = (baseHue + i * (360 / count)) % 360;
            palette.push([hue, saturation, brightness]);
        }
        return palette;
    }

    function hsbToRgb(h, s, b) {
        h = h / 360;
        s = s / 100;
        b = b / 100;

        let r, g, blue;

        if (s === 0) {
            r = g = blue = b;
        } else {
            const hueToRgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = b < 0.5 ? b * (1 + s) : b + s - b * s;
            const p = 2 * b - q;
            r = hueToRgb(p, q, h + 1 / 3);
            g = hueToRgb(p, q, h);
            blue = hueToRgb(p, q, h - 1 / 3);
        }

        return [
            Math.round(r * 255),
            Math.round(g * 255),
            Math.round(blue * 255)
        ];
    }

    function saveCanvasWithTimestamp(filenamePrefix = 'sketch', extension = 'png') {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        saveCanvas(`${filenamePrefix}_${timestamp}`, extension);
    }

    function announceAppReady(appName, appObject) {
        if (typeof window === 'undefined') return;

        window[`${appName.toUpperCase()}_APP`] = appObject;
        window.dispatchEvent(new CustomEvent(`${appName.toLowerCase()}-ready`, {
            detail: appObject
        }));
    }

    function registerKeyboardShortcuts(shortcuts) {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            const ctrl = event.ctrlKey || event.metaKey;
            const shift = event.shiftKey;
            const alt = event.altKey;

            for (const shortcut of shortcuts) {
                const matchesKey = shortcut.key === key;
                const matchesCtrl = !shortcut.ctrl || ctrl;
                const matchesShift = !shortcut.shift || shift;
                const matchesAlt = !shortcut.alt || alt;

                if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
                    event.preventDefault();
                    shortcut.handler(event);
                    break;
                }
            }
        });
    }

    function requestRedraw(callback, delay = 0) {
        if (delay > 0) {
            setTimeout(() => {
                if (callback) callback();
                redraw();
            }, delay);
        } else {
            if (callback) callback();
            redraw();
        }
    }

    function generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function mapRange(value, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    }

    function constrainToCircle(x, y, centerX, centerY, radius) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius) {
            return {x, y};
        }

        const angle = Math.atan2(dy, dx);
        return {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius
        };
    }

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    return {
        clampNumber,
        clampToInt,
        normalizeColor,
        normalizeOrigin,
        pickWeighted,
        lerpColorArray,
        deepClone,
        attachCanvas,
        updateStatusPanel,
        isMouseInBounds,
        drawRoundedRect,
        drawOverlay,
        formatNumber,
        debounce,
        throttle,
        createPalette,
        hsbToRgb,
        saveCanvasWithTimestamp,
        announceAppReady,
        registerKeyboardShortcuts,
        requestRedraw,
        generateId,
        mapRange,
        constrainToCircle,
        easeInOutCubic,
        shuffleArray
    };
})();

if (typeof window !== 'undefined') {
    window.Utils = Utils;
}