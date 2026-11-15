import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectionManager from '../interaction/SelectionManager';
import SelectionTool from '../interaction/tools/SelectionTool';
import DrawingEngine from '../DrawingEngine';
import Wall from '../models/Wall';
import Column from '../models/Column';

afterEach(() => vi.unstubAllGlobals());

function setup(type = 'wall') {
    vi.stubGlobal('document', { dispatchEvent: vi.fn() });
    const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } });
    const column = new Column({ position: { x: 2000, y: 2000 } });
    const engine = new DrawingEngine();
    engine.elements = [wall, column];
    engine.onModelChange = vi.fn();
    const selectionManager = new SelectionManager();
    selectionManager.selectedElements = type === 'wall' ? [wall] : type === 'column' ? [column] : [];
    vi.spyOn(selectionManager, 'select');
    vi.spyOn(selectionManager, 'clear');
    vi.spyOn(selectionManager, 'isPointInsidePolygon');
    vi.spyOn(selectionManager, 'isPointInsideColumn');
    const requestRender = vi.fn(), renderSelection = vi.fn();
    const tool = new SelectionTool({ engine, selectionManager, getScale: () => 0.1, requestRender, renderSelection });
    return { tool, engine, wall, column, selectionManager, requestRender, renderSelection };
}

const wallPoint = { x: 500, y: 0 };

describe('selection gestures', () => {
    it('selects using resolved wall footprints and renders the selected identity', () => {
        const { tool, engine, wall, selectionManager, renderSelection } = setup();
        tool.handleClick(wallPoint);
        expect(selectionManager.select).toHaveBeenCalledWith(wallPoint, engine.elements, engine.getWallDisplayGeometry());
        expect(renderSelection).toHaveBeenLastCalledWith(new Set([wall.id]));
        tool.handleClick({ x: 9000, y: 9000 });
        expect(renderSelection).toHaveBeenLastCalledWith(new Set());
    });

    it('starts wall dragging only inside its resolved footprint', () => {
        const { tool, engine, wall, selectionManager } = setup();
        selectionManager.isPointInsidePolygon.mockReturnValue(false);
        tool.startDrag(wallPoint);
        expect(tool.isDragging).toBe(false);
        expect(selectionManager.isPointInsidePolygon).toHaveBeenCalledWith(wallPoint, engine.getWallDisplayGeometry().get(wall.id));
    });

    it('requires a selected column and a pointer inside it before dragging', () => {
        const { tool, column, selectionManager, engine } = setup(null);
        tool.startDrag({ x: 2100, y: 2200 });
        expect(tool.isDragging).toBe(false);
        selectionManager.setSelection([column]);
        selectionManager.isPointInsideColumn.mockReturnValue(false);
        tool.startDrag({ x: 2100, y: 2200 });
        expect(tool.isDragging).toBe(false);
        selectionManager.isPointInsideColumn.mockReturnValue(true);
        tool.startDrag({ x: 2100, y: 2200 });
        tool.updateDrag({ x: 3100, y: 4200 });
        expect(column.position).toEqual({ x: 3000, y: 4000 });
        expect(engine.onModelChange).toHaveBeenCalledOnce();
    });

    it.each([[20, false], [21, true]])('suppresses the next click only beyond the two-pixel wall-drag threshold (%s mm)', (distance, suppress) => {
        const { tool, wall } = setup();
        tool.startDrag(wallPoint);
        tool.updateDrag({ x: 500, y: distance });
        tool.endDrag();
        expect(tool.isDragging).toBe(false);
        expect(wall.start.y).toBe(distance);
        expect(tool.consumeNextClick()).toBe(suppress);
        expect(tool.consumeNextClick()).toBe(false);
    });

    it('does not suppress ordinary clicks after a wall press without movement', () => {
        const { tool } = setup();
        tool.startDrag(wallPoint);
        tool.endDrag();
        expect(tool.consumeNextClick()).toBe(false);
    });

    it('retains the existing column behavior of allowing selection after a drag', () => {
        const { tool } = setup('column');
        tool.startDrag({ x: 2100, y: 2200 });
        tool.updateDrag({ x: 3100, y: 4200 });
        tool.endDrag();
        expect(tool.consumeNextClick()).toBe(false);
    });

    it('does not mutate geometry after mouseup or request a redraw without an active drag', () => {
        const { tool, engine, requestRender } = setup();
        tool.updateDrag({ x: 500, y: 200 });
        tool.startDrag(wallPoint);
        tool.endDrag();
        tool.updateDrag({ x: 500, y: 200 });
        expect(engine.onModelChange).not.toHaveBeenCalled();
        expect(requestRender).not.toHaveBeenCalled();
    });

    it('ends a column gesture if selection is cleared externally', () => {
        const { tool, selectionManager, requestRender } = setup('column');
        tool.startDrag({ x: 2100, y: 2200 });
        selectionManager.clear();
        tool.updateDrag({ x: 3100, y: 4200 });
        expect(tool.isDragging).toBe(false);
        expect(requestRender).not.toHaveBeenCalled();
    });

    it('cancels transient state without rolling back committed movement or clearing selection by default', () => {
        const { tool, wall, selectionManager } = setup();
        tool.startDrag(wallPoint);
        tool.updateDrag({ x: 500, y: 200 });
        tool.endDrag();
        tool.cancel();
        expect(tool.consumeNextClick()).toBe(false);
        expect(tool.isDragging).toBe(false);
        expect(wall.start.y).toBe(200);
        expect(selectionManager.selectedElement).toBe(wall);
        expect(selectionManager.clear).not.toHaveBeenCalled();
        tool.cancel({ clearSelection: true });
        expect(tool.hasSelection).toBe(false);
        expect(selectionManager.clear).toHaveBeenCalledOnce();
    });

    it('deletes through the engine, clears selection, and cancels the active gesture', () => {
        const { tool, engine, wall, selectionManager } = setup();
        tool.startDrag(wallPoint);
        tool.deleteSelected();
        expect(engine.elements.some(e => e.id === wall.id)).toBe(false);
        expect(engine.onModelChange).toHaveBeenCalledOnce();
        expect(selectionManager.clear).toHaveBeenCalledOnce();
        expect(tool.isDragging).toBe(false);
        expect(tool.hasSelection).toBe(false);
        tool.updateDrag({ x: 500, y: 200 });
        tool.deleteSelected();
        expect(engine.onModelChange).toHaveBeenCalledOnce();
    });
});
