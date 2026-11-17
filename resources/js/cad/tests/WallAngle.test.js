import { expect, it, vi } from 'vitest';
import CanvasRenderer from '../rendering/CanvasRenderer';
import WallPreviewRenderer from '../rendering/WallPreviewRenderer';
import DrawingEngine from '../DrawingEngine';
import SnapManager from '../interaction/SnapManager';
import Wall from '../models/Wall';
import DrawingView from '../rendering/DrawingView';

it('shows the angle to a connected wall and falls back to horizontal when unconnected', () => {
    const ctx = new Proxy({ fillText: vi.fn() }, {
        get: (target, key) => target[key] ?? vi.fn(),
    });
    const renderer = new CanvasRenderer({ width: 800, height: 600, getContext: () => ctx });
    const engine = new DrawingEngine();
    engine.addWall({ x: -1000, y: 0 }, { x: 1000, y: 0 });
    const preview = new WallPreviewRenderer({ renderer, previewRenderer: renderer, engine, snapManager: new SnapManager() });
    const draw = (start, end) => {
        ctx.fillText.mockClear();
        preview.render(new Wall({ start, end }), engine.elements);
        return ctx.fillText.mock.calls.map(call => call[0]);
    };

    expect(draw({ x: 0, y: 0 }, { x: 1000, y: -1000 })).toContain('45°');
    expect(draw({ x: 1000, y: 0 }, { x: 2000, y: 0 })).toContain('180°');
    expect(draw({ x: 3000, y: 0 }, { x: 4000, y: 1000 })).toContain('315°');
});

it('draws corner angles for completed walls and updates them after undo', () => {
    const ctx = new Proxy({ fillText: vi.fn() }, {
        get: (target, key) => target[key] ?? vi.fn(),
    });
    const renderer = new CanvasRenderer({ width: 800, height: 600, getContext: () => ctx });
    const engine = new DrawingEngine();
    const view = new DrawingView(engine, renderer);
    engine.addWall({ x: 1000, y: 1000 }, { x: 3000, y: 1000 });
    engine.addWall({ x: 3000, y: 1000 }, { x: 3000, y: 3000 });
    engine.addWall({ x: 3000, y: 3000 }, { x: 1000, y: 3000 });
    engine.addWall({ x: 1000, y: 3000 }, { x: 1000, y: 1000 });

    view.render();
    expect(ctx.fillText.mock.calls.map(call => call[0])).toEqual(['90°', '90°', '90°', '90°']);
    ctx.fillText.mockClear();
    engine.undo();
    view.render();
    expect(ctx.fillText.mock.calls.map(call => call[0])).toEqual(['90°', '90°']);
});
