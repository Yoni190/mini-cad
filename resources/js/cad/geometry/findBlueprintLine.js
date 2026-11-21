export default function findBlueprintLine(imageData, point) {
    const { data, width, height } = imageData;
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);

    if (
        !Number.isFinite(x) || !Number.isFinite(y) ||
        x < 0 || y < 0 || x >= width || y >= height
    ) {
        return null;
    }

    function isDark(pixelX, pixelY) {
        const index = (pixelY * width + pixelX) * 4;
        const alpha = data[index + 3] / 255;

        const red = data[index] * alpha + 255 * (1 - alpha);
        const green = data[index + 1] * alpha + 255 * (1 - alpha);
        const blue = data[index + 2] * alpha + 255 * (1 - alpha);

        return (red + green + blue) / 3 < 128;
    }

    if (!isDark(x, y)) {
        return null;
    }

    let left = x;
    let right = x;
    let top = y;
    let bottom = y;

    while (left > 0 && isDark(left - 1, y)) left--;
    while (right < width - 1 && isDark(right + 1, y)) right++;
    while (top > 0 && isDark(x, top - 1)) top--;
    while (bottom < height - 1 && isDark(x, bottom + 1)) bottom++;

    const horizontalLength = right - left + 1;
    const verticalLength = bottom - top + 1;
    const minimumLength = 20;

    if (horizontalLength < minimumLength && verticalLength < minimumLength) {
        return null;
    }

    if (horizontalLength >= verticalLength) {
        return {
            start: { x: left, y },
            end: { x: right, y },
        };
    }

    return {
        start: { x, y: top },
        end: { x, y: bottom },
    };
}

export function findBlueprintLineNear(imageData, point) {
    const centerX = Math.floor(point.x);
    const centerY = Math.floor(point.y);
    const searchRadius = 4;

    if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
        return null;
    }

    for (let radius = 0; radius <= searchRadius; radius++) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
                    continue;
                }

                const line = findBlueprintLine(imageData, {
                    x: centerX + dx,
                    y: centerY + dy,
                });

                if (line) return line;
            }
        }
    }

    return null;
}