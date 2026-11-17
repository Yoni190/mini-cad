import { afterEach, describe, expect, it, vi } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import SelectionManager from '../interaction/SelectionManager';
import SelectionTool from '../interaction/tools/SelectionTool';

afterEach(() => vi.unstubAllGlobals());

describe('drawing history', () => {
    it('undoes and redoes edits, and discards redo after a new edit', () => {
        const engine = new DrawingEngine();
        engine.addColumn({ x: 0, y: 0 });
        const id = engine.elements[0].id;
        engine.updateColumnDimensions(id, 500, 600, 3000);
        expect(engine.undo()).toBe(true);
        expect(engine.elements[0].width).toBe(400);
        expect(engine.redo()).toBe(true);
        expect(engine.elements[0].width).toBe(500);
        expect(engine.elements[0].getGeometry()).toHaveLength(4);
        engine.undo();
        engine.removeElements([id]);
        expect(engine.redo()).toBe(false);
        expect(engine.elements).toEqual([]);
        engine.undo();
        expect(engine.elements[0].id).toBe(id);
    });

    it.each(['end', 'cancel', 'selection cleared'])('undoes a %s drag in one step', finish => {
        vi.stubGlobal('document', { dispatchEvent: vi.fn() });
        const engine = new DrawingEngine();
        engine.addColumn({ x: 0, y: 0 });
        const selection = new SelectionManager();
        selection.setSelection([engine.elements[0]]);
        const tool = new SelectionTool({ engine, selectionManager: selection, getScale: () => 1,
            requestRender: vi.fn(), renderSelection: vi.fn(), renderBox: vi.fn(), clearBox: vi.fn() });
        tool.startDrag({ x: 0, y: 0 });
        tool.updateDrag({ x: 100, y: 100 });
        tool.updateDrag({ x: 200, y: 200 });
        if (finish === 'end') tool.endDrag();
        else if (finish === 'cancel') tool.cancel();
        else {
            selection.clear();
            tool.updateDrag({ x: 300, y: 300 });
        }
        expect(engine.undo()).toBe(true);
        expect(engine.elements[0].position).toEqual({ x: 0, y: 0 });
        expect(engine.redo()).toBe(true);
        expect(engine.elements[0].position).toEqual({ x: 200, y: 200 });
    });

    it('restores existing walls when a new wall splits them', () => {
        const engine = new DrawingEngine();
        engine.addWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
        const before = JSON.stringify(engine.elements);
        engine.addWall({ x: 500, y: 0 }, { x: 500, y: 1000 });
        expect(engine.elements).toHaveLength(3);
        engine.undo();
        expect(JSON.stringify(engine.elements)).toBe(before);
    });
});
