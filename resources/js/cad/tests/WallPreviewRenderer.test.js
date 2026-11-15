import { describe, expect, it, vi } from 'vitest';
import WallPreviewRenderer from '../rendering/WallPreviewRenderer';
import Wall from '../models/Wall';

function setup(snapped = false) {
    const renderer = { scale: 0.5, offsetX: 20, offsetY: -30 };
    const previewRenderer = Object.fromEntries([
        'clear', 'drawElement', 'drawWallLength', 'drawWallGuides', 'drawSnapMarker',
    ].map(name => [name, vi.fn()]));
    const snapManager = { isOnWall: vi.fn(() => snapped) };
    const wallPreview = new WallPreviewRenderer({ renderer, previewRenderer, snapManager });
    const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } });
    const elements = [wall];
    return { renderer, previewRenderer, snapManager, wallPreview, wall, elements };
}

describe('wall preview rendering', () => {
    it('matches the main transform, clears the previous frame, and draws the wall and annotations', () => {
        const { wallPreview, previewRenderer, wall, elements } = setup();
        previewRenderer.drawElement.mockImplementation(() => {
            expect(previewRenderer.scale).toBe(0.5);
            expect(previewRenderer.offsetX).toBe(20);
            expect(previewRenderer.offsetY).toBe(-30);
            expect(previewRenderer.clear).toHaveBeenCalledOnce();
        });
        wallPreview.render(wall, elements);
        expect(previewRenderer.drawElement).toHaveBeenCalledWith(wall, true);
        expect(previewRenderer.drawWallLength).toHaveBeenCalledWith(wall);
        expect(previewRenderer.drawWallGuides).toHaveBeenCalledWith(wall, elements);
        expect(previewRenderer.drawSnapMarker).not.toHaveBeenCalled();
    });

    it('uses the latest pan/zoom rather than keeping a stale transform', () => {
        const { wallPreview, renderer, previewRenderer, wall, elements } = setup();
        wallPreview.render(wall, elements);
        Object.assign(renderer, { scale: 1.5, offsetX: -200, offsetY: 400 });
        wallPreview.render(wall, elements);
        expect(previewRenderer.scale).toBe(1.5);
        expect(previewRenderer.offsetX).toBe(-200);
        expect(previewRenderer.offsetY).toBe(400);
    });

    it('clears stale visuals when drafting produces no valid preview', () => {
        const { wallPreview, previewRenderer, snapManager } = setup();
        wallPreview.render(null, []);
        expect(previewRenderer.clear).toHaveBeenCalledOnce();
        expect(previewRenderer.drawElement).not.toHaveBeenCalled();
        expect(previewRenderer.drawWallLength).not.toHaveBeenCalled();
        expect(previewRenderer.drawWallGuides).not.toHaveBeenCalled();
        expect(snapManager.isOnWall).not.toHaveBeenCalled();
    });

    it('marks a preview endpoint only when snapping recognizes a wall connection', () => {
        const { wallPreview, previewRenderer, snapManager, wall, elements } = setup(true);
        wallPreview.render(wall, elements);
        expect(snapManager.isOnWall).toHaveBeenCalledWith(wall.end, elements);
        expect(previewRenderer.drawSnapMarker).toHaveBeenCalledWith(wall.end);
    });

    it.each([false, true])('shows guides before the first click, with snapped=%s', snapped => {
        const { wallPreview, previewRenderer, snapManager, wall, elements } = setup(snapped);
        wallPreview.renderStartHints(wall.start, elements);
        expect(previewRenderer.clear).toHaveBeenCalledOnce();
        expect(previewRenderer.scale).toBe(0.5);
        expect(previewRenderer.drawWallGuides).toHaveBeenCalledWith({ start: null, end: wall.start }, elements);
        expect(previewRenderer.drawElement).not.toHaveBeenCalled();
        expect(previewRenderer.drawWallLength).not.toHaveBeenCalled();
        expect(snapManager.isOnWall).toHaveBeenCalledWith(wall.start, elements);
        expect(previewRenderer.drawSnapMarker).toHaveBeenCalledTimes(snapped ? 1 : 0);
    });
});
