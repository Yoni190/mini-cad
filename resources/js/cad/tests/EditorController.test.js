import { afterEach, describe, expect, it, vi } from 'vitest';
import EditorController from '../EditorController';

afterEach(() => vi.unstubAllGlobals());

describe('pending wall input', () => {
    function setup() {
        const elements = [];
        const engine = {
            elements,
            render: vi.fn(),
            addWall: vi.fn((start, end) => elements.push({ type: 'wall', start, end })),
        };
        const controller = new EditorController(null, engine, null, null, { clear: vi.fn() });
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
