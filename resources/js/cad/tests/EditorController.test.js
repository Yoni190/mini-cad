import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectionManager from '../interaction/SelectionManager';
import EditorController from '../interaction/EditorController';
import createWallInputs from '../ui/wall-inputs';

afterEach(() => vi.unstubAllGlobals());

describe('pending wall input', () => {
    function setup() {
        const elements = [];
        const engine = {
            elements,
            addWall: vi.fn((start, end) => elements.push({ type: 'wall', start, end })),
        };
        const inputs = {
            wallLength: { value: '' },
            newWallThickness: { value: '200', checkValidity: () => true },
            threeContainer: { style: { display: 'none' } },
        };
        vi.stubGlobal('document', { getElementById: id => inputs[id] });
        const controller = new EditorController(null, engine, null, null, { clear: vi.fn() }, { render: vi.fn() }, createWallInputs(), { clear: vi.fn() });
        controller.getMousePoint = event => event.point;
        return { controller, engine, inputs };
    }

    it('shows the column limit error', () => {
        const { controller, engine } = setup();
        vi.stubGlobal('alert', vi.fn());
        controller.activeTool = 'column';
        engine.addColumn = vi.fn(() => { throw new Error('Element limit reached'); });
        controller.handleClick({ button: 0, point: { x: 0, y: 0 } });
        expect(alert).toHaveBeenCalledWith('Element limit reached');
    });

    it('keeps the first click in the controller until a wall is committed', () => {
        const { controller, engine } = setup();
        const point = { x: 1000, y: 2000 };

        expect(controller.wallTool.startPoint).toBeNull();
        controller.handleClick({ button: 0, point });

        expect(controller.wallTool.startPoint).toEqual(point);
        expect(controller.wallTool.wallChainStart).toEqual(point);
        expect(engine.elements).toEqual([]);
        expect(engine.addWall).not.toHaveBeenCalled();
        expect(engine).not.toHaveProperty('startPoint');
        expect(controller).not.toHaveProperty('startPoint');
    });

    it('creates a numeric-length wall from the pending point and continues from its endpoint', () => {
        const { controller, engine } = setup();
        controller.handleClick({ button: 0, point: { x: 1000, y: 2000 } });
        controller.wallTool.directionPoint = { x: 1300, y: 2400 };
        controller.applyWallLength(2000);

        expect(engine.addWall).toHaveBeenCalledWith(
            { x: 1000, y: 2000 }, { x: 2200, y: 3600 }, 200
        );
        expect(controller.wallTool.startPoint).toEqual({ x: 2200, y: 3600 });
        expect(controller.wallTool.wallChainCount).toBe(1);
        expect(engine).not.toHaveProperty('startPoint');
    });

    it.each(['cancel', 'Escape', 'lock'])('discards unfinished drawing on %s without removing committed walls', action => {
        const { controller, engine } = setup();
        const start = { x: 0, y: 0 };
        const end = { x: 1000, y: 0 };
        controller.handleClick({ button: 0, point: start });
        controller.wallTool.commitWall(end);
        controller.wallTool.directionPoint = { x: 1000, y: 1000 };
        controller.wallTool.alignmentHold = { x: 1000, y: 0 };

        if (action === 'Escape') {
            vi.stubGlobal('HTMLElement', class {});
            controller.handleKeyDown({ key: 'Escape' });
        } else if (action === 'lock') {
            controller.setEditingLocked(true);
            controller.setEditingLocked(false);
        } else {
            controller.cancelWallDrawing();
        }

        expect(controller.wallTool.startPoint).toBeNull();
        expect(controller.wallTool.directionPoint).toBeNull();
        expect(controller.wallTool.wallChainStart).toBeNull();
        expect(controller.wallTool.wallChainCount).toBe(0);
        expect(controller.wallTool.alignmentHold).toEqual({ x: null, y: null });
        expect(engine.elements).toEqual([{ type: 'wall', start, end }]);

        // A fresh click starts a new chain instead of extending the old wall.
        const nextStart = { x: 5000, y: 5000 };
        controller.handleClick({ button: 0, point: nextStart });
        expect(controller.wallTool.startPoint).toEqual(nextStart);
        expect(controller.wallTool.wallChainStart).toEqual(nextStart);
        expect(engine.addWall).toHaveBeenCalledTimes(1);
    });

    it('routes drafting keys only outside inputs, without modifiers, and in 2D', () => {
        const { controller, inputs } = setup();
        class Field { matches() { return true; } }
        vi.stubGlobal('HTMLElement', Field);
        controller.handleClick({ button: 0, point: { x: 0, y: 0 } });
        controller.renderWallPreview = vi.fn();
        const key = properties => ({ key: '5', preventDefault: vi.fn(), ...properties });
        controller.handleKeyDown(key({ target: new Field() }));
        controller.handleKeyDown(key({ ctrlKey: true }));
        inputs.threeContainer.style.display = 'block';
        controller.handleKeyDown(key());
        expect(inputs.wallLength.value).toBe('');
        inputs.threeContainer.style.display = 'none';
        controller.handleKeyDown(key());
        expect(inputs.wallLength.value).toBe('5');
        expect(controller.renderWallPreview).toHaveBeenCalledOnce();
    });

    it('clears pending drafting when switching tools through the UI', () => {
        const { controller, engine } = setup();
        const toolSelect = Object.assign(new EventTarget(), { value: 'select' });
        const button = new EventTarget();
        controller.canvas = new EventTarget();
        vi.stubGlobal('window', new EventTarget());
        vi.stubGlobal('document', Object.assign(new EventTarget(), {
            getElementById: id => id === 'drawingTool' ? toolSelect : button,
        }));
        controller.init();
        controller.wallTool.handleClick({ x: 0, y: 0 });
        toolSelect.dispatchEvent(new Event('change'));
        expect(controller.activeTool).toBe('select');
        expect(controller.wallTool.startPoint).toBeNull();
        expect(engine.elements).toEqual([]);
        expect(controller.selectionManager.clear).toHaveBeenCalledOnce();
    });

    it('coalesces full redraws and restores the active tool preview after drawing', () => {
        const { controller } = setup();
        controller.wallTool.handleClick({ x: 0, y: 0 });
        controller.wallTool.directionPoint = { x: 1000, y: 0 };
        controller.renderWallPreview = vi.fn();
        const frames = new Map();
        let frameId = 0;
        vi.stubGlobal('requestAnimationFrame', callback => {
            frames.set(++frameId, callback);
            return frameId;
        });
        vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
        controller.scheduleWallPreview();
        controller.scheduleCanvasRender();
        controller.scheduleCanvasRender();
        expect(frames.size).toBe(1);
        [...frames.values()][0]();
        expect(controller.view.render).toHaveBeenCalledOnce();
        expect(controller.renderWallPreview).toHaveBeenCalledOnce();
        expect(controller.pendingPreviewFrame).toBeNull();
        expect(controller.pendingRenderFrame).toBeNull();
    });

    it('delegates preview geometry, initial hints, and clearing to the preview renderer', () => {
        const { controller, engine } = setup();
        const preview = { clear: vi.fn(), render: vi.fn(), renderStartHints: vi.fn() };
        controller.wallPreviewRenderer = preview;
        controller.handleMouseMove({ point: { x: 1000, y: 0 } });
        expect(preview.renderStartHints).toHaveBeenCalledWith({ x: 1000, y: 0 }, engine.elements);
        controller.handleClick({ button: 0, point: { x: 0, y: 0 } });
        expect(preview.clear).toHaveBeenCalledOnce();
        controller.wallTool.directionPoint = { x: 1000, y: 0 };
        controller.renderWallPreview();
        expect(preview.render).toHaveBeenCalledWith(expect.objectContaining({
            start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 200,
        }), engine.elements);
        controller.cancelWallDrawing();
        controller.renderWallPreview();
        expect(preview.render).toHaveBeenLastCalledWith(null, engine.elements);
    });

    it('does not draw a queued preview after the pending wall is cancelled', () => {
        const { controller } = setup();
        controller.wallTool.startPoint = { x: 0, y: 0 };
        controller.wallTool.directionPoint = { x: 1000, y: 0 };
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

describe('property actions', () => {
    function setup(selectedElement = null) {
        const engine = { updateColumnDimensions: vi.fn(), updateWallThickness: vi.fn(), updateWallHeight: vi.fn() };
        const selection = new SelectionManager();
        selection.selectedElements = selectedElement ? [selectedElement] : [];
        const controller = new EditorController(null, engine, null, null, selection, null, { setLength: vi.fn() });
        controller.wallTool.createWallWithLength = vi.fn();
        controller.renderWallPreview = vi.fn();
        return { controller, engine };
    }

    it('validates numeric length before delegating to drafting', () => {
        const { controller } = setup();
        for (const length of [0, -1, NaN, Infinity]) {
            expect(() => controller.applyWallLength(length)).toThrow('Please enter a positive wall length.');
        }
        expect(controller.wallTool.createWallWithLength).not.toHaveBeenCalled();
        controller.applyWallLength(1000);
        expect(controller.wallTool.createWallWithLength).toHaveBeenCalledWith(1000);
    });

    it('requires column selection, Select mode, and positive finite dimensions', () => {
        const { controller, engine } = setup();
        expect(() => controller.updateSelectedColumnDimensions(300, 400)).toThrow('Please select a column first.');
        controller.selectionManager.selectedElements = [{ id: 'column', type: 'column' }];
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
        controller.selectionManager.selectedElements = [{ id: 'wall', type: 'wall' }];
        controller.updateSelectedWallThickness('200');
        expect(engine.updateWallThickness).toHaveBeenCalledWith('wall', '200');
        engine.updateWallThickness.mockImplementation(() => { throw new Error('Invalid thickness'); });
        expect(() => controller.updateSelectedWallThickness('bad')).toThrow('Invalid thickness');
    });

    it('updates height only for a selected wall in Select mode', () => {
        const { controller, engine } = setup();
        controller.updateSelectedWallHeight('2800');
        expect(engine.updateWallHeight).not.toHaveBeenCalled();
        controller.activeTool = 'select';
        expect(() => controller.updateSelectedWallHeight('2800')).toThrow('Please select a wall first.');
        controller.selectionManager.selectedElements = [{ id: 'wall', type: 'wall' }];
        controller.updateSelectedWallHeight('2800');
        expect(engine.updateWallHeight).toHaveBeenCalledWith('wall', '2800');
    });

    it('blocks all property actions when editing is locked', () => {
        const { controller, engine } = setup();
        controller.isEditingLocked = true;
        controller.applyWallLength(1000);
        controller.updateSelectedColumnDimensions(300, 400);
        controller.updateSelectedWallThickness('200');
        controller.wallTool.startPoint = { x: 0, y: 0 };
        controller.wallTool.directionPoint = { x: 100, y: 0 };
        controller.refreshWallPreview();
        expect(controller.wallTool.createWallWithLength).not.toHaveBeenCalled();
        expect(engine.updateColumnDimensions).not.toHaveBeenCalled();
        expect(engine.updateWallThickness).not.toHaveBeenCalled();
        expect(controller.renderWallPreview).not.toHaveBeenCalled();
    });

    it('refreshes a preview only for an active wall with a start and direction', () => {
        const { controller } = setup();
        controller.refreshWallPreview();
        controller.wallTool.startPoint = { x: 0, y: 0 };
        controller.refreshWallPreview();
        expect(controller.renderWallPreview).not.toHaveBeenCalled();
        controller.wallTool.directionPoint = { x: 100, y: 0 };
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
        const controller = new EditorController(canvas, {}, renderer, null, {}, { render: vi.fn() }, { setLength: vi.fn() });
        controller.scheduleCanvasRender = vi.fn();
        controller.wallPreviewRenderer = { clear: vi.fn(), renderStartHints: vi.fn() };
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
        expect(controller.wallPreviewRenderer.renderStartHints).not.toHaveBeenCalled();
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

describe('selection routing and cancellation', () => {
    function setup() {
        const canvas = new EventTarget();
        const selectInput = Object.assign(new EventTarget(), { value: 'wall' });
        const threeContainer = { style: { display: 'none' } };
        vi.stubGlobal('window', new EventTarget());
        vi.stubGlobal('document', Object.assign(new EventTarget(), {
            getElementById: id => id === 'drawingTool' ? selectInput : id === 'threeContainer' ? threeContainer : new EventTarget(),
        }));
        vi.stubGlobal('HTMLElement', class {});
        const selected = { id: 'column', type: 'column', position: { x: 100, y: 100 } };
        const selectionManager = new SelectionManager();
        selectionManager.selectedElements = [selected];
        vi.spyOn(selectionManager, 'select').mockReturnValue(selected);
        vi.spyOn(selectionManager, 'clear');
        vi.spyOn(selectionManager, 'isPointInsideColumn').mockReturnValue(true);
        const engine = { elements: [selected], getWallDisplayGeometry: () => new Map(), moveColumn: vi.fn(), removeElements: vi.fn() };
        const controller = new EditorController(canvas, engine, { scale: 1 }, null, selectionManager, { render: vi.fn() }, { setLength: vi.fn() }, { clear: vi.fn() });
        controller.activeTool = 'select';
        controller.getMousePoint = vi.fn(event => event.point);
        controller.scheduleCanvasRender = vi.fn();
        controller.init();
        return { controller, engine, selectionManager, selectInput, threeContainer };
    }

    it('uses unsnapped selection coordinates and consumes a post-drag click only once', () => {
        const { controller, selectionManager } = setup();
        controller.selectionTool.suppressNextClick = true;
        controller.handleClick({ button: 0, point: { x: 120, y: 120 } });
        expect(selectionManager.select).not.toHaveBeenCalled();
        controller.handleClick({ button: 0, point: { x: 120, y: 120 } });
        expect(selectionManager.select).toHaveBeenCalledOnce();
        expect(controller.getMousePoint).toHaveBeenLastCalledWith(expect.anything(), false);
    });

    it.each(['Escape', 'tool change', 'lock', 'new project action'])('cancels active dragging on %s', action => {
        const { controller, engine, selectionManager, selectInput } = setup();
        controller.handleMouseDown({ button: 0, point: { x: 120, y: 120 } });
        expect(controller.selectionTool.isDragging).toBe(true);
        if (action === 'Escape') controller.handleKeyDown({ key: 'Escape' });
        if (action === 'tool change') selectInput.dispatchEvent(new Event('change'));
        if (action === 'lock') {
            controller.setEditingLocked(true);
            controller.setEditingLocked(false);
        }
        if (action === 'new project action') controller.cancelInteraction({ clearSelection: true });
        expect(controller.selectionTool.isDragging).toBe(false);
        controller.activeTool = 'select';
        controller.handleMouseMove({ point: { x: 500, y: 500 } });
        expect(engine.moveColumn).not.toHaveBeenCalled();
        if (action === 'lock') expect(selectionManager.clear).not.toHaveBeenCalled();
        else expect(selectionManager.clear).toHaveBeenCalledOnce();
    });

    it('stops dragging on the window mouseup listener', () => {
        const { controller } = setup();
        controller.handleMouseDown({ button: 0, point: { x: 120, y: 120 } });
        window.dispatchEvent(new Event('mouseup'));
        expect(controller.selectionTool.isDragging).toBe(false);
    });

    it('gives panning priority over an active selection drag', () => {
        const { controller, engine } = setup();
        controller.handleMouseDown({ button: 0, point: { x: 120, y: 120 } });
        controller.navigation.isPanning = true;
        controller.navigation.updatePan = vi.fn();
        controller.handleMouseMove({ point: { x: 500, y: 500 } });
        expect(controller.navigation.updatePan).toHaveBeenCalledOnce();
        expect(engine.moveColumn).not.toHaveBeenCalled();
    });

    it('blocks selection, dragging, and deletion while locked', () => {
        const { controller, engine, selectionManager } = setup();
        controller.setEditingLocked(true);
        controller.handleClick({ button: 0, point: { x: 120, y: 120 } });
        controller.handleMouseDown({ button: 0, point: { x: 120, y: 120 } });
        controller.handleMouseMove({ point: { x: 500, y: 500 } });
        controller.handleKeyDown({ key: 'Delete' });
        expect(controller.selectionTool.isDragging).toBe(false);
        expect(selectionManager.select).not.toHaveBeenCalled();
        expect(engine.moveColumn).not.toHaveBeenCalled();
        expect(engine.removeElements).not.toHaveBeenCalled();
    });

    it.each(['Delete', 'Backspace'])('does not delete the hidden selection in 3D with %s', key => {
        const { controller, engine, selectionManager, threeContainer } = setup();
        threeContainer.style.display = 'block';
        const event = { key, preventDefault: vi.fn() };
        controller.handleKeyDown(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(engine.removeElements).not.toHaveBeenCalled();
        expect(selectionManager.selectedElement).not.toBeNull();

        threeContainer.style.display = 'none';
        controller.handleKeyDown(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(engine.removeElements).toHaveBeenCalledWith(new Set(['column']));
    });

    it.each(['Delete', 'Backspace'])('routes %s to deletion while preserving typing in form fields', key => {
        const { controller, engine } = setup();
        for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
            controller.handleKeyDown({ key, target: { tagName } });
        }
        expect(engine.removeElements).not.toHaveBeenCalled();
        const event = { key, preventDefault: vi.fn() };
        controller.handleKeyDown(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(engine.removeElements).toHaveBeenCalledWith(new Set(['column']));
    });
});
