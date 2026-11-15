import { afterEach, describe, expect, it, vi } from 'vitest';
import EditorController from '../interaction/EditorController';

afterEach(() => vi.unstubAllGlobals());

describe('pending wall input', () => {
    function setup() {
        const elements = [];
        const engine = {
            elements,
            addWall: vi.fn((start, end) => elements.push({ type: 'wall', start, end })),
        };
        const controller = new EditorController(null, engine, null, null, { clear: vi.fn() }, { render: vi.fn() });
        controller.previewRenderer = { clear: vi.fn() };
        controller.getMousePoint = event => event.point;
        const inputs = {
            wallLength: { value: '' },
            newWallThickness: { value: '200', checkValidity: () => true },
            threeContainer: { style: { display: 'none' } },
        };
        vi.stubGlobal('document', { getElementById: id => inputs[id] });
        return { controller, engine, inputs };
    }

    it('keeps the first click in the controller until a wall is committed', () => {
        const { controller, engine } = setup();
        const point = { x: 1000, y: 2000 };

        expect(controller.startPoint).toBeNull();
        controller.handleClick({ button: 0, point });

        expect(controller.startPoint).toEqual(point);
        expect(controller.wallChainStart).toEqual(point);
        expect(engine.elements).toEqual([]);
        expect(engine.addWall).not.toHaveBeenCalled();
        expect(engine).not.toHaveProperty('startPoint');
    });

    it('creates a numeric-length wall from the pending point and continues from its endpoint', () => {
        const { controller, engine } = setup();
        controller.handleClick({ button: 0, point: { x: 1000, y: 2000 } });
        controller.directionPoint = { x: 1300, y: 2400 };
        controller.constrainWallPoint = point => point;

        controller.createWallWithLength(2000);

        expect(engine.addWall).toHaveBeenCalledWith(
            { x: 1000, y: 2000 }, { x: 2200, y: 3600 }, 200
        );
        expect(controller.startPoint).toEqual({ x: 2200, y: 3600 });
        expect(controller.wallChainCount).toBe(1);
        expect(engine).not.toHaveProperty('startPoint');
    });

    it.each(['cancel', 'Escape', 'lock'])('discards unfinished drawing on %s without removing committed walls', action => {
        const { controller, engine } = setup();
        const start = { x: 0, y: 0 };
        const end = { x: 1000, y: 0 };
        controller.handleClick({ button: 0, point: start });
        controller.commitWall(end);
        controller.directionPoint = { x: 1000, y: 1000 };
        controller.alignmentHold = { x: 1000, y: 0 };

        if (action === 'Escape') {
            vi.stubGlobal('HTMLElement', class {});
            controller.handleKeyDown({ key: 'Escape' });
        } else if (action === 'lock') {
            controller.setEditingLocked(true);
            controller.setEditingLocked(false);
        } else {
            controller.cancelWallDrawing();
        }

        expect(controller.startPoint).toBeNull();
        expect(controller.directionPoint).toBeNull();
        expect(controller.wallChainStart).toBeNull();
        expect(controller.wallChainCount).toBe(0);
        expect(controller.alignmentHold).toEqual({ x: null, y: null });
        expect(engine.elements).toEqual([{ type: 'wall', start, end }]);

        // A fresh click starts a new chain instead of extending the old wall.
        const nextStart = { x: 5000, y: 5000 };
        controller.handleClick({ button: 0, point: nextStart });
        expect(controller.startPoint).toEqual(nextStart);
        expect(controller.wallChainStart).toEqual(nextStart);
        expect(engine.addWall).toHaveBeenCalledTimes(1);
    });

    it('does not draw a queued preview after the pending wall is cancelled', () => {
        const { controller } = setup();
        controller.startPoint = { x: 0, y: 0 };
        controller.directionPoint = { x: 1000, y: 0 };
        controller.renderWallPreview = vi.fn();
        let drawFrame;
        vi.stubGlobal('requestAnimationFrame', callback => {
            drawFrame = callback;
            return 1;
        });

        controller.scheduleWallPreview();
        controller.cancelWallDrawing();
        drawFrame();

        expect(controller.renderWallPreview).not.toHaveBeenCalled();
    });
});

describe('wall chain completion', () => {
    it('finishes a new chain when it reconnects through existing walls', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 1000, y: 0 };
        const c = { x: 1000, y: 1000 };
        const d = { x: 0, y: 1000 };
        const elements = [
            { type: 'wall', start: a, end: b },
            { type: 'wall', start: b, end: c },
        ];
        const engine = {
            elements,
            addWall(start, end) { elements.push({ type: 'wall', start, end }); },
        };
        const controller = new EditorController(null, engine, null, null, null);
        controller.startPoint = a;
        controller.wallChainStart = a;
        const inputs = { newWallThickness: { value: '200', checkValidity: () => true }, wallLength: { value: '' } };
        vi.stubGlobal('document', { getElementById: id => inputs[id] });

        controller.commitWall(d);
        expect(controller.startPoint).toEqual(d);
        controller.commitWall(c);

        expect(elements).toHaveLength(4);
        expect(controller.startPoint).toBeNull();
        expect(controller.wallChainStart).toBeNull();
    });
});

describe('property actions', () => {
    function setup(selectedElement = null) {
        const engine = { updateColumnDimensions: vi.fn(), updateWallThickness: vi.fn() };
        const controller = new EditorController(null, engine, null, null, { selectedElement });
        controller.createWallWithLength = vi.fn();
        controller.renderWallPreview = vi.fn();
        return { controller, engine };
    }

    it('validates numeric length before delegating to drafting', () => {
        const { controller } = setup();
        for (const length of [0, -1, NaN, Infinity]) {
            expect(() => controller.applyWallLength(length)).toThrow('Please enter a positive wall length.');
        }
        expect(controller.createWallWithLength).not.toHaveBeenCalled();
        controller.applyWallLength(1000);
        expect(controller.createWallWithLength).toHaveBeenCalledWith(1000);
    });

    it('requires column selection, Select mode, and positive finite dimensions', () => {
        const { controller, engine } = setup();
        expect(() => controller.updateSelectedColumnDimensions(300, 400)).toThrow('Please select a column first.');
        controller.selectionManager.selectedElement = { id: 'column', type: 'column' };
        controller.updateSelectedColumnDimensions(300, 400);
        expect(engine.updateColumnDimensions).not.toHaveBeenCalled();
        controller.activeTool = 'select';
        for (const [width, depth] of [[0, 400], [300, -1], [NaN, 400], [300, Infinity]]) {
            expect(() => controller.updateSelectedColumnDimensions(width, depth)).toThrow('Width and depth must be positive numbers.');
        }
        controller.updateSelectedColumnDimensions(300, 400);
        expect(engine.updateColumnDimensions).toHaveBeenCalledExactlyOnceWith('column', 300, 400);
    });

    it('requires Select mode and a wall, and passes engine validation failures to the UI', () => {
        const { controller, engine } = setup();
        controller.updateSelectedWallThickness('200');
        expect(engine.updateWallThickness).not.toHaveBeenCalled();
        controller.activeTool = 'select';
        expect(() => controller.updateSelectedWallThickness('200')).toThrow('Please select a wall first.');
        controller.selectionManager.selectedElement = { id: 'wall', type: 'wall' };
        controller.updateSelectedWallThickness('200');
        expect(engine.updateWallThickness).toHaveBeenCalledWith('wall', '200');
        engine.updateWallThickness.mockImplementation(() => { throw new Error('Invalid thickness'); });
        expect(() => controller.updateSelectedWallThickness('bad')).toThrow('Invalid thickness');
    });

    it('blocks all property actions when editing is locked', () => {
        const { controller, engine } = setup();
        controller.isEditingLocked = true;
        controller.applyWallLength(1000);
        controller.updateSelectedColumnDimensions(300, 400);
        controller.updateSelectedWallThickness('200');
        controller.startPoint = { x: 0, y: 0 };
        controller.directionPoint = { x: 100, y: 0 };
        controller.refreshWallPreview();
        expect(controller.createWallWithLength).not.toHaveBeenCalled();
        expect(engine.updateColumnDimensions).not.toHaveBeenCalled();
        expect(engine.updateWallThickness).not.toHaveBeenCalled();
        expect(controller.renderWallPreview).not.toHaveBeenCalled();
    });

    it('refreshes a preview only for an active wall with a start and direction', () => {
        const { controller } = setup();
        controller.refreshWallPreview();
        controller.startPoint = { x: 0, y: 0 };
        controller.refreshWallPreview();
        expect(controller.renderWallPreview).not.toHaveBeenCalled();
        controller.directionPoint = { x: 100, y: 0 };
        controller.refreshWallPreview();
        expect(controller.renderWallPreview).toHaveBeenCalledOnce();
        controller.activeTool = 'select';
        controller.refreshWallPreview();
        expect(controller.renderWallPreview).toHaveBeenCalledOnce();
    });
});

describe('navigation routing', () => {
    function setup() {
        const canvas = Object.assign(new EventTarget(), {
            getBoundingClientRect: () => ({ left: 0, top: 0 }),
        });
        const renderer = { scale: 1, offsetX: 0, offsetY: 0, screenToWorld: (x, y) => ({ x, y }) };
        const controller = new EditorController(canvas, {}, renderer, null, {}, { render: vi.fn() });
        controller.scheduleCanvasRender = vi.fn();
        controller.renderWallStartHints = vi.fn();
        vi.stubGlobal('window', new EventTarget());
        vi.stubGlobal('document', Object.assign(new EventTarget(), {
            getElementById: () => new EventTarget(),
        }));
        controller.init();
        return { controller, renderer };
    }

    it('prioritizes panning over wall previews and stops on a mouseup outside the canvas', () => {
        const { controller, renderer } = setup();
        controller.handleMouseDown({ button: 1, clientX: 10, clientY: 20, preventDefault() {} });
        controller.handleMouseMove({ clientX: 30, clientY: 40 });
        expect(renderer.offsetX).toBe(20);
        expect(renderer.offsetY).toBe(20);
        expect(controller.renderWallStartHints).not.toHaveBeenCalled();
        expect(controller.scheduleCanvasRender).toHaveBeenCalledOnce();
        window.dispatchEvent(new Event('mouseup'));
        expect(controller.navigation.isPanning).toBe(false);
        expect(controller.navigation.lastPanPoint).toBeNull();
    });

    it('cancels panning on lock and blocks navigation until unlocked', () => {
        const { controller, renderer } = setup();
        const down = { button: 1, clientX: 10, clientY: 20, preventDefault: vi.fn() };
        controller.handleMouseDown(down);
        controller.setEditingLocked(true);
        expect(controller.navigation.isPanning).toBe(false);
        controller.handleMouseDown(down);
        controller.handleMouseMove({ clientX: 30, clientY: 40 });
        const wheel = { clientX: 30, clientY: 40, deltaY: -1, preventDefault: vi.fn() };
        controller.handleWheel(wheel);
        expect(controller.navigation.isPanning).toBe(false);
        expect(renderer.scale).toBe(1);
        expect(renderer.offsetX).toBe(0);
        expect(controller.scheduleCanvasRender).not.toHaveBeenCalled();
        expect(wheel.preventDefault).not.toHaveBeenCalled();
        controller.setEditingLocked(false);
        controller.handleWheel(wheel);
        expect(renderer.scale).toBe(1.1);
        expect(controller.scheduleCanvasRender).toHaveBeenCalledOnce();
    });
});
