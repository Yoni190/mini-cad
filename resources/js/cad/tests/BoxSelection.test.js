import { afterEach, describe, expect, it, vi } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import SelectionManager from '../interaction/SelectionManager';
import EditorController from '../interaction/EditorController';
import DrawingView from '../rendering/DrawingView';
import Wall from '../models/Wall';
import Column from '../models/Column';

afterEach(() => vi.unstubAllGlobals());

function setup() {
    const canvasEvents = {}, windowEvents = {};
    const canvas = { addEventListener: (name, handler) => { canvasEvents[name] = handler; } };
    const control = { addEventListener: vi.fn() };
    vi.stubGlobal('document', { dispatchEvent: vi.fn(), addEventListener: vi.fn(), getElementById: () => control });
    vi.stubGlobal('window', { addEventListener: (name, handler) => { windowEvents[name] = handler; } });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('CustomEvent', class { constructor(type, options) { Object.assign(this, { type, ...options }); } });
    const engine = new DrawingEngine();
    const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } });
    const column = new Column({ position: { x: 2000, y: 2000 } });
    const outside = new Column({ position: { x: 6000, y: 6000 } });
    engine.elements = [wall, column, outside];
    engine.onModelChange = vi.fn();
    const selection = new SelectionManager();
    const preview = { renderSelectionBox: vi.fn(), clear: vi.fn() };
    const view = { render: vi.fn() };
    const editor = new EditorController(canvas, engine, { scale: 0.1 }, null, selection, view, { setLength: vi.fn() }, preview);
    editor.activeTool = 'select';
    editor.getMousePoint = event => event.point;
    editor.init();
    const event = (point, extra = {}) => ({ button: 0, point, target: canvas, ...extra });
    return { engine, wall, column, outside, selection, preview, view, editor, canvasEvents, windowEvents, canvas, event };
}

describe('select all shortcut', () => {
    it.each(['ctrlKey', 'metaKey'])('selects all elements and switches to Select with %s', modifier => {
        const { engine, selection, editor, view } = setup();
        vi.stubGlobal('HTMLElement', class {});
        const tool = { value: 'wall', dispatchEvent: vi.fn(() => { editor.activeTool = 'select'; }) };
        document.getElementById = id => id === 'twoContainer' ? { style: { display: 'block' } } : tool;
        editor.activeTool = 'wall';
        const event = { key: 'a', [modifier]: true, preventDefault: vi.fn() };
        editor.handleKeyDown(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(tool.value).toBe('select');
        expect(tool.dispatchEvent).toHaveBeenCalledOnce();
        expect(selection.selectedElements).toEqual(engine.elements);
        expect(view.render).toHaveBeenLastCalledWith(selection.selectedIds);
        engine.elements.push(new Column({ position: { x: 8000, y: 8000 } }));
        expect(selection.selectedElements).toHaveLength(3);
    });

    it('leaves text fields and the 3D view to the browser', () => {
        const { selection, editor } = setup();
        class Field { matches() { return true; } }
        vi.stubGlobal('HTMLElement', Field);
        const event = { key: 'a', ctrlKey: true, target: new Field(), preventDefault: vi.fn() };
        editor.handleKeyDown(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(selection.selectedElements).toEqual([]);
        document.getElementById = () => ({ style: { display: 'none' } });
        editor.handleKeyDown({ ...event, target: null });
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(selection.selectedElements).toEqual([]);
    });
});

describe('box selection', () => {
    it.each([false, true])('starts on the second press and finishes on release (reverse=%s)', reversed => {
        const { canvasEvents, windowEvents, event, selection, wall, column, preview, view } = setup();
        const a = { x: -100, y: -100 }, b = { x: 3000, y: 3000 };
        const start = reversed ? b : a, end = reversed ? a : b;
        canvasEvents.mousedown(event(start, { detail: 1 }));
        windowEvents.mouseup(event(start));
        canvasEvents.click(event(start, { detail: 1 }));
        canvasEvents.mousedown(event(start, { detail: 2 }));
        canvasEvents.mousemove(event(end));
        expect(selection.selectedElements).toEqual([]);
        expect(preview.renderSelectionBox).toHaveBeenLastCalledWith(start, end);
        windowEvents.mouseup(event(end));
        expect(selection.selectedElements).toEqual([wall, column]);
        expect(view.render).toHaveBeenLastCalledWith(new Set([wall.id, column.id]));
        preview.renderSelectionBox.mockClear();
        canvasEvents.mousemove(event(start));
        expect(preview.renderSelectionBox).not.toHaveBeenCalled();
        canvasEvents.click(event(end, { detail: 2 }));
        expect(selection.selectedElements).toEqual([wall, column]);
    });

    it('finishes outside the canvas without swallowing the next click', () => {
        const { canvasEvents, windowEvents, event, selection, wall, column, editor } = setup();
        const start = { x: -100, y: -100 }, end = { x: 3000, y: 3000 };
        canvasEvents.mousedown(event(start, { detail: 2 }));
        windowEvents.mousemove(event(end, { target: window }));
        windowEvents.mouseup(event(end, { target: window }));
        expect(editor.selectionTool.box).toBeNull();
        expect(selection.selectedElements).toEqual([wall, column]);
        canvasEvents.click(event({ x: 7000, y: 7000 }));
        expect(selection.selectedElements).toEqual([]);
    });

    it('highlights, moves and deletes selected elements as a group', () => {
        const { engine, wall, column, outside, selection, editor } = setup();
        selection.setSelection([wall, column]);
        const renderer = { clear: vi.fn(), drawGrid: vi.fn(), isGeometryVisible: () => true, drawElement: vi.fn(), drawWallCornerAngles: vi.fn() };
        new DrawingView(engine, renderer).render(selection.selectedIds);
        expect(renderer.drawElement.mock.calls.map(call => [call[0], call[2]])).toEqual([[wall, true], [column, true], [outside, false]]);
        const tool = editor.selectionTool;
        tool.startDrag({ x: 2100, y: 2100 });
        tool.updateDrag({ x: 2600, y: 2400 });
        tool.endDrag();
        expect(wall.start).toEqual({ x: 500, y: 300 });
        expect(column.position).toEqual({ x: 2500, y: 2300 });
        expect(outside.position).toEqual({ x: 6000, y: 6000 });
        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
        tool.deleteSelected();
        expect(engine.elements).toEqual([outside]);
        expect(selection.selectedElements).toEqual([]);
        expect(engine.onModelChange).toHaveBeenCalledTimes(2);
    });

    it('cancels an unfinished box without changing the selection', () => {
        const { selection, wall, editor, preview } = setup();
        selection.setSelection([wall]);
        editor.selectionTool.startBox({ x: 0, y: 0 });
        editor.selectionTool.cancel();
        expect(preview.clear).toHaveBeenCalledOnce();
        expect(selection.selectedElement).toBe(wall);
        expect(editor.selectionTool.box).toBeNull();
    });
});
