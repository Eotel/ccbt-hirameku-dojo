/**
 * 指定した座標とサイズで円を描画する関数。
 *
 * @param {number} x - 円の中心のX座標。
 * @param {number} y - 円の中心のY座標。
 * @param {number} size - 描画する円の直径。
 * @param {number} rotation - 円を回転させる角度（弧度法）。
 */
const drawCircle = (x, y, size, rotation = 0) => {
    push();
    translate(x, y);
    rotate(rotation);
    circle(0, 0, size);
    pop();
};

/**
 * 指定した座標とサイズで四角形を描画する関数。
 *
 * @param {number} x - 四角形の中心のX座標。
 * @param {number} y - 四角形の中心のY座標。
 * @param {number} size - 描画する四角形のサイズ。
 * @param {number} rotation - 四角形を回転させる角度（弧度法）。
 */
const drawSquare = (x, y, size, rotation = 0) => {
    push();
    translate(x, y);
    rotate(rotation);
    rectMode(CENTER);
    square(0, 0, size);
    pop();
};


/**
 * 指定した座標とサイズで矩形を描画する関数。
 *
 * @param {number} x - 矩形の中心のX座標。
 * @param {number} y - 矩形の中心のY座標。
 * @param {number} w - 矩形の幅。
 * @param {number} h - 矩形の高さ。
 * @param {number} tl - 左上角の角丸の半径。
 * @param {number} tr - 右上角の角丸の半径。
 * @param {number} bl - 左下角の角丸の半径。
 * @param {number} br - 右下角の角丸の半径。
 * @param {number} rotation - 矩形を回転させる角度（弧度法）。
 */
const drawRect = (x, y, w, h, tl = 0, tr = 0, bl = 0, br = 0, rotation = 0) => {
    push();
    translate(x, y);
    rotate(rotation);
    rectMode(CENTER);
    rect(0, 0, w, h, tl, tr, br, bl);
    pop();
};

/**
 * Draws a regular polygon centered at the given coordinates.
 *
 * @param {number} x - The x-coordinate of the center of the polygon.
 * @param {number} y - The y-coordinate of the center of the polygon.
 * @param {number} d - The diameter of the polygon, which is the distance from the center to any vertex.
 * @param {number} vertexNum - The number of vertices (sides) of the polygon.
 * @param {number} rotation - 四角形を回転させる角度（弧度法）。
 */
const drawPolygon = (x, y, d, vertexNum, rotation = 0) => {
    push();
    angleMode(RADIANS);
    translate(x, y);
    rotate(rotation);

    beginShape();
    for (let i = 0; i < vertexNum; i++) {
        let angle = TWO_PI * i / vertexNum; // 弧度法での角度を計算
        vertex(d / 2 * cos(angle), d / 2 * sin(angle));
    }
    endShape(CLOSE);
    pop();
};

/**
 * Draws a diamond shape centered at the given coordinates.
 * The diamond is inscribed within a circle with diameter d.
 * The aspect ratio controls the relative width and height of the diamond.
 *
 * @param {number} x - The x-coordinate of the center of the diamond.
 * @param {number} y - The y-coordinate of the center of the diamond.
 * @param {number} d - The diameter of the circle in which the diamond is inscribed.
 * @param {number} [aspectRatio=1] - The aspect ratio of the diamond (width/height).
 *                                   A value of 1 results in a square diamond.
 * @param {number} rotation - 四角形を回転させる角度（弧度法）。
 */
const drawDiamond = (x, y, d, aspectRatio = 1, rotation = 0) => {
    push();
    angleMode(RADIANS);
    translate(x, y);
    rotate(rotation);

    // 縦横の調整: 内接するように直径 `d` を基準に調整
    const widthR = d / 2;
    const heightR = widthR * aspectRatio;

    beginShape();
    for (let i = 0; i < 4; i++) {
        let R = i % 2 === 0 ? widthR : heightR;
        let angle = HALF_PI * i;

        vertex(R * cos(angle), R * sin(angle));
    }
    endShape(CLOSE);
    pop();
};

/**
 * Draws an equilateral triangle centered at the given coordinates.
 * The triangle is inscribed within a circle with diameter d.
 * The triangle is oriented upwards by default, and can be further rotated by the specified angle.
 *
 * @param {number} x - The x-coordinate of the center of the triangle.
 * @param {number} y - The y-coordinate of the center of the triangle.
 * @param {number} d - The diameter of the circle in which the triangle is inscribed.
 * @param {number} [rotation=0] - The additional rotation angle in radians.
 *                                This angle is added to the default orientation (PI / 6).
 */
const drawTriangle = (x, y, d, rotation = 0) => {
    const initialAngle = PI / 6; // 内部で保持される初期角度

    push();
    angleMode(RADIANS);
    translate(x, y); // 中心となる座標

    // 初期角度に外部からの回転角度を加算して、三角形の描画を開始
    beginShape();
    for (let i = 0; i < 3; i++) {
        let angle = initialAngle + rotation + TWO_PI * i / 3;
        vertex((d / 2) * cos(angle), (d / 2) * sin(angle));
    }
    endShape(CLOSE);
    pop();
};

const drawStar = (x, y, d, prickleNum, rotation = 0) => {
    let vertexNum = prickleNum * 2; // 頂点数(トゲの数*2)
    let R; // 中心点から頂点までの距離

    push();
    angleMode(RADIANS);
    translate(x, y);
    rotate(-PI / 2);
    rotate(rotation);

    beginShape();
    for (let i = 0; i < vertexNum; i++) {
        R = i % 2 === 0 ? d / 2 : d / 4;
        vertex(R * cos(TWO_PI * i / vertexNum), R * sin(TWO_PI * i / vertexNum));
    }
    endShape(CLOSE);
    pop();
};

/**
 * 指定した座標とサイズで直線を描画する関数。
 * 直線はデフォルトで左上から右下に向かって描画されます。
 *
 * @param {number} x - 直線の中心のX座標。
 * @param {number} y - 直線の中心のY座標。
 * @param {number} size - 描画する直線が収まる正方形のサイズ。
 * @param {number} rotation - 直線を回転させる角度（弧度法）。
 */
const drawLine = (x, y, size, rotation = 0) => {
    push();
    translate(x, y);
    rotate(rotation);
    line(-size / 2, -size / 2, size / 2, size / 2);
    pop();
};