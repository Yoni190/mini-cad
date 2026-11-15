import { describe, expect, it, vi } from 'vitest';
import CanvasNavigation from '../interaction/CanvasNavigation';

function setup(scale = 0.5) {
    const renderer = {
        scale, offsetX: 40, offsetY: -20,
        screenToWorld(x, y) {
            return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale };
        },
    };
    const requestRender = vi.fn();
    const navigation = new CanvasNavigation({
        canvas: { getBoundingClientRect: () => ({ left: 100, top: 50 }) },
        renderer, requestRender,
    });
    return { navigation, renderer, requestRender };
}

describe('canvas navigation', () => {
    it('pans in screen pixels, using the most recent pointer position', () => {
        const { navigation, renderer, requestRender } = setup();
        const preventDefault = vi.fn();
        navigation.startPan({ clientX: 100, clientY: 200, preventDefault });
        navigation.updatePan({ clientX: 120, clientY: 190 });
        navigation.updatePan({ clientX: 125, clientY: 210 });
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(renderer.offsetX).toBe(65);
        expect(renderer.offsetY).toBe(-10);
        expect(renderer.scale).toBe(0.5);
        expect(requestRender).toHaveBeenCalledTimes(2);
    });

    it('ignores movement before and after a pan', () => {
        const { navigation, renderer, requestRender } = setup();
        navigation.updatePan({ clientX: 120, clientY: 190 });
        navigation.startPan({ clientX: 100, clientY: 200, preventDefault() {} });
        navigation.stopPan();
        navigation.updatePan({ clientX: 120, clientY: 190 });
        expect(navigation.isPanning).toBe(false);
        expect(navigation.lastPanPoint).toBeNull();
        expect(renderer.offsetX).toBe(40);
        expect(requestRender).not.toHaveBeenCalled();
    });

    it.each([-100, 100])('keeps the world point under the cursor fixed for wheel delta %s', deltaY => {
        const { navigation, renderer, requestRender } = setup();
        // Client coordinates (350, 200) map to canvas coordinates (250, 150).
        const before = renderer.screenToWorld(250, 150);
        const preventDefault = vi.fn();
        navigation.zoom({ clientX: 350, clientY: 200, deltaY, preventDefault });
        const after = renderer.screenToWorld(250, 150);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
        expect(renderer.scale).toBeCloseTo(deltaY < 0 ? 0.55 : 0.45);
        expect(preventDefault).toHaveBeenCalledOnce();
        expect(requestRender).toHaveBeenCalledOnce();
    });

    it.each([[1.99, -1, 2], [0.0101, 1, 0.01]])('clamps scale %s to its zoom limit', (scale, deltaY, limit) => {
        const { navigation, renderer, requestRender } = setup(scale);
        navigation.zoom({ clientX: 350, clientY: 200, deltaY, preventDefault() {} });
        expect(renderer.scale).toBe(limit);
        expect(requestRender).toHaveBeenCalledOnce();
        const offsets = [renderer.offsetX, renderer.offsetY];
        navigation.zoom({ clientX: 350, clientY: 200, deltaY, preventDefault() {} });
        expect(requestRender).toHaveBeenCalledOnce();
        expect([renderer.offsetX, renderer.offsetY]).toEqual(offsets);
    });
});
