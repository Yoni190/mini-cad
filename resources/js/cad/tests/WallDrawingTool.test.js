import { describe, expect, it, vi } from 'vitest';
import WallDrawingTool from '../interaction/tools/WallDrawingTool';
import Wall from '../models/Wall';

function setup() {
    let length = '', thickness = 200;
    const engine = {
        elements: [],
        findWallsNear: vi.fn(() => engine.elements.filter(element => element.type === 'wall')),
        addWall: vi.fn((start, end, thickness) => {
            engine.elements.push(new Wall({ start, end, thickness }));
        }),
    };
    const inputs = {
        getLength: () => length,
        setLength: value => { length = value; },
        getThickness: vi.fn(() => thickness),
        setOrtho: vi.fn(),
    };
    const preview = { clear: vi.fn(), render: vi.fn(), request: vi.fn(), showStartHints: vi.fn() };
    const snapManager = { snap: vi.fn(point => point) };
    const showMessage = vi.fn();
    const tool = new WallDrawingTool({
        engine, inputs, preview, snapManager, showMessage,
        getScale: () => 0.5,
    });
    return { tool, engine, inputs, preview, snapManager, showMessage,
        setThickness: value => { thickness = value; } };
}

const a = { x: 0, y: 0 };
const b = { x: 1000, y: 0 };
const c = { x: 1000, y: 1000 };

describe('wall drafting', () => {
    it('keeps pending points outside the engine and continues from a committed endpoint', () => {
        const { tool, engine, inputs, preview } = setup();
        inputs.setLength('500');
        tool.handleClick(a);
        expect(engine.elements).toEqual([]);
        expect(inputs.getLength()).toBe('');
        expect(preview.clear).toHaveBeenCalledOnce();
        tool.handleClick(b);
        expect(engine.addWall).toHaveBeenCalledWith(a, b, 200);
        expect(tool.startPoint).toEqual(b);
        expect(tool.directionPoint).toBeNull();
        expect(tool.wallChainCount).toBe(1);
        expect(engine).not.toHaveProperty('startPoint');
    });

    it('uses the same exact endpoint for numeric preview and commit without resnapping', () => {
        const { tool, engine, inputs, snapManager } = setup();
        tool.handleClick({ x: 1000, y: 2000 });
        tool.handleMouseMove({ x: 1300, y: 2400 });
        inputs.setLength('2000');
        const preview = tool.getPreview();
        expect(preview.end).toEqual({ x: 2200, y: 3600 });
        expect(engine.elements).toEqual([]);
        tool.createWallWithLength(2000);
        expect(engine.addWall).toHaveBeenCalledWith(preview.start, preview.end, preview.thickness);
        expect(snapManager.snap).not.toHaveBeenCalled();
    });

    it('routes numeric keys, backspace, and Enter while pointer movement preserves typed length', () => {
        const { tool, inputs, engine, preview } = setup();
        tool.handleClick(a);
        tool.handleMouseMove(b);
        const press = key => {
            const event = { key, preventDefault: vi.fn() };
            expect(tool.handleKeyDown(event)).toBe(true);
            expect(event.preventDefault).toHaveBeenCalledOnce();
        };
        for (const key of ['5', '0', '0', 'Backspace']) press(key);
        expect(inputs.getLength()).toBe('50');
        press('.');
        expect(inputs.getLength()).toBe('50');
        press('Enter');
        expect(engine.addWall).toHaveBeenCalledWith(a, { x: 50, y: 0 }, 200);
        expect(preview.render).toHaveBeenCalledTimes(4);
        inputs.setLength('600');
        tool.handleMouseMove(c);
        expect(inputs.getLength()).toBe('600');
        expect(preview.request).toHaveBeenCalledTimes(2);
        const event = { key: 'x', preventDefault: vi.fn() };
        expect(tool.handleKeyDown(event)).toBe(false);
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('constrains horizontal and vertical endpoints before snapping with the locked axis', () => {
        const { tool, inputs, snapManager } = setup();
        tool.handleClick(a);
        tool.toggleOrtho();
        expect(inputs.setOrtho).toHaveBeenCalledWith(true);
        expect(tool.getSnappedPoint({ x: 1000, y: 100 })).toEqual(b);
        expect(snapManager.snap).toHaveBeenLastCalledWith(b, [], 40, { axis: 'y', value: 0 });
        expect(tool.getSnappedPoint({ x: 100, y: 1000 })).toEqual({ x: 0, y: 1000 });
        expect(snapManager.snap).toHaveBeenLastCalledWith({ x: 0, y: 1000 }, [], 40, { axis: 'x', value: 0 });
    });

    it('aligns points within the zoom-scaled threshold and releases outside it', () => {
        const { tool } = setup();
        tool.handleClick(a);
        expect(tool.alignWallPoint({ x: 15, y: 100 })).toEqual({ x: 0, y: 100 });
        expect(tool.alignWallPoint({ x: 16, y: 100 })).toEqual({ x: 16, y: 100 });
        expect(tool.alignWallPoint({ x: 50, y: 100 })).toEqual({ x: 50, y: 100 });
    });

    it('rejects a two-edge closure and finishes a valid chain at the exact original point', () => {
        const { tool, engine, showMessage } = setup();
        tool.handleClick(a);
        tool.handleClick(b);
        tool.handleClick(a);
        expect(showMessage).toHaveBeenCalledWith('A room needs at least three walls.');
        expect(engine.elements).toHaveLength(1);
        tool.handleClick(c);
        tool.handleClick({ x: 0.1e-6, y: 0 });
        expect(engine.elements).toHaveLength(3);
        expect(engine.elements[2].end).toEqual(a);
        expect(tool.startPoint).toBeNull();
        expect(tool.wallChainCount).toBe(0);
    });

    it('finishes a chain when it reconnects through existing walls', () => {
        const { tool, engine } = setup();
        engine.elements.push(new Wall({ start: a, end: b }), new Wall({ start: b, end: c }));
        tool.handleClick(a);
        tool.handleClick({ x: 0, y: 1000 });
        tool.handleClick(c);
        expect(engine.elements).toHaveLength(4);
        expect(tool.startPoint).toBeNull();
    });

    it('silently omits invalid previews and requests thickness feedback only on commit', () => {
        const { tool, engine, inputs, setThickness } = setup();
        tool.handleClick(a);
        tool.handleMouseMove(b);
        setThickness(null);
        expect(tool.getPreview()).toBeNull();
        expect(inputs.getThickness).toHaveBeenLastCalledWith();
        tool.commitWall(b);
        expect(inputs.getThickness).toHaveBeenLastCalledWith(true);
        expect(engine.addWall).not.toHaveBeenCalled();
        expect(tool.startPoint).toEqual(a);
        expect(tool.wallChainCount).toBe(0);
    });

    it('preserves drafting state and reports engine failures', () => {
        const { tool, engine, showMessage } = setup();
        tool.handleClick(a);
        tool.handleMouseMove(b);
        engine.addWall.mockImplementation(() => { throw new Error('Invalid junction'); });
        tool.commitWall(b);
        expect(showMessage).toHaveBeenCalledWith('Invalid junction');
        expect(tool.startPoint).toEqual(a);
        expect(tool.directionPoint).toEqual(b);
        expect(tool.wallChainCount).toBe(0);
    });

    it('ignores zero-length commits and reports missing or zero numeric direction', () => {
        const { tool, engine, showMessage } = setup();
        tool.createWallWithLength(1000);
        expect(showMessage).toHaveBeenLastCalledWith('Click a starting point and move the mouse to choose a direction.');
        tool.handleClick(a);
        tool.handleMouseMove(a);
        expect(tool.getPreview()).toBeNull();
        tool.createWallWithLength(1000);
        expect(showMessage).toHaveBeenLastCalledWith('Move the mouse to choose a wall direction first.');
        tool.commitWall(a);
        expect(engine.addWall).not.toHaveBeenCalled();
    });

    it('cancels only pending drafting and preserves the Ortho preference and committed walls', () => {
        const { tool, engine } = setup();
        tool.handleClick(a);
        tool.handleClick(b);
        tool.toggleOrtho();
        tool.handleMouseMove(c);
        tool.cancel();
        expect(tool.hasPreview).toBe(false);
        expect(tool.startPoint).toBeNull();
        expect(tool.wallChainStart).toBeNull();
        expect(tool.wallChainCount).toBe(0);
        expect(tool.alignmentHold).toEqual({ x: null, y: null });
        expect(tool.orthoEnabled).toBe(true);
        expect(engine.elements).toHaveLength(1);
    });
});
