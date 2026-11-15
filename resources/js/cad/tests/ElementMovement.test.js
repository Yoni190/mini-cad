import { describe, expect, it, vi } from 'vitest';
import SelectionManager from '../interaction/SelectionManager';
import DrawingEngine from '../DrawingEngine';
import EditorController from '../interaction/EditorController';
import Wall from '../models/Wall';
import Column from '../models/Column';

function setup() {
    const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } });
    const neighbor = new Wall({ start: wall.end, end: { x: 1000, y: 1000 } });
    const column = new Column({ position: { x: 2000, y: 2000 } });
    const engine = new DrawingEngine();
    engine.elements = [wall, neighbor, column];
    engine.onModelChange = vi.fn();
    return { engine, wall, neighbor, column };
}

describe('column movement', () => {
    it('moves the existing instance, copies input and notifies without recalculating wall geometry', () => {
        const { engine, column } = setup();
        const cached = engine.getWallDisplayGeometry();
        const position = { x: 3000, y: 4000 };

        expect(engine.moveColumn(column.id, position)).toBe(true);
        expect(engine.elements[2]).toBe(column);
        expect(column.position).toEqual(position);
        position.x = 9999;
        expect(column.position.x).toBe(3000);
        expect(engine.getWallDisplayGeometry()).toBe(cached);
        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
    });

    it('does not notify when the position is unchanged', () => {
        const { engine, column } = setup();
        expect(engine.moveColumn(column.id, { ...column.position })).toBe(false);
        expect(engine.onModelChange).not.toHaveBeenCalled();
    });

    it.each([null, { x: NaN, y: 0 }, { x: 0, y: Infinity }])('rejects invalid position %j without changing the column', position => {
        const { engine, column } = setup();
        expect(() => engine.moveColumn(column.id, position)).toThrow('Invalid column position');
        expect(column.position).toEqual({ x: 2000, y: 2000 });
        expect(engine.onModelChange).not.toHaveBeenCalled();
    });

    it('rejects missing elements and elements of the wrong type', () => {
        const { engine, wall } = setup();
        for (const id of ['missing', wall.id]) {
            expect(() => engine.moveColumn(id, { x: 0, y: 0 })).toThrow('Column not found');
        }
    });
});

describe('wall endpoint updates', () => {
    it('commits connected walls together before notifying and refreshes cached footprints', () => {
        const { engine, wall, neighbor } = setup();
        const cached = engine.getWallDisplayGeometry();
        const junction = { x: 1000, y: 200 };
        engine.onModelChange.mockImplementation(() => {
            expect(wall.end).toEqual(junction);
            expect(neighbor.start).toEqual(junction);
        });

        expect(engine.updateWallEndpoints([
            { id: wall.id, start: { x: 0, y: 200 }, end: junction },
            { id: neighbor.id, start: junction, end: neighbor.end },
        ])).toBe(true);

        expect(engine.elements[0]).toBe(wall);
        expect(engine.elements[1]).toBe(neighbor);
        expect(wall.getLength()).toBe(1000);
        expect(neighbor.getLength()).toBe(800);
        expect(engine.getWallDisplayGeometry()).not.toBe(cached);
        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
        junction.y = 9999;
        expect(wall.end.y).toBe(200);
        expect(neighbor.start.y).toBe(200);
        expect(wall.end).not.toBe(neighbor.start);
    });

    it.each([0, 0.0005])('rejects the entire batch if a neighbor would have length %s mm', length => {
        const { engine, wall, neighbor } = setup();
        const cached = engine.getWallDisplayGeometry();

        expect(engine.updateWallEndpoints([
            { id: wall.id, start: { x: 0, y: 1000 - length }, end: { x: 1000, y: 1000 - length } },
            { id: neighbor.id, start: { x: 1000, y: 1000 - length }, end: neighbor.end },
        ])).toBe(false);

        expect(wall.start).toEqual({ x: 0, y: 0 });
        expect(wall.end).toEqual({ x: 1000, y: 0 });
        expect(neighbor.start).toEqual({ x: 1000, y: 0 });
        expect(engine.getWallDisplayGeometry()).toBe(cached);
        expect(engine.onModelChange).not.toHaveBeenCalled();
    });

    it.each(['missing', 'column', 'invalid point', 'duplicate'])('does not partially commit a batch containing %s', problem => {
        const { engine, wall, neighbor, column } = setup();
        const first = { id: wall.id, start: { x: 0, y: 200 }, end: { x: 1000, y: 200 } };
        const second = { id: neighbor.id, start: { x: 1000, y: 200 }, end: neighbor.end };
        if (problem === 'missing') second.id = 'missing';
        if (problem === 'column') second.id = column.id;
        if (problem === 'invalid point') second.start = { x: NaN, y: 200 };
        if (problem === 'duplicate') second.id = wall.id;

        expect(() => engine.updateWallEndpoints([first, second])).toThrow();
        expect(wall.start).toEqual({ x: 0, y: 0 });
        expect(wall.end).toEqual({ x: 1000, y: 0 });
        expect(engine.onModelChange).not.toHaveBeenCalled();
    });

    it('skips empty and unchanged batches', () => {
        const { engine, wall } = setup();
        const cached = engine.getWallDisplayGeometry();
        expect(engine.updateWallEndpoints([])).toBe(false);
        expect(engine.updateWallEndpoints([{ id: wall.id, start: wall.start, end: wall.end }])).toBe(false);
        expect(engine.getWallDisplayGeometry()).toBe(cached);
        expect(engine.onModelChange).not.toHaveBeenCalled();
    });
});

describe('dragging through the engine', () => {
    function controllerFor(engine, selected) {
        const selection = new SelectionManager();
        selection.selectedElements = [selected];
        const controller = new EditorController(null, engine, { scale: 0.1 }, null, selection);
        controller.activeTool = 'select';
        controller.getMousePoint = event => event.point;
        controller.scheduleCanvasRender = vi.fn();
        return controller;
    }

    it('applies the column drag offset and schedules a redraw only after movement', () => {
        const { engine, column } = setup();
        const controller = controllerFor(engine, column);
        controller.handleMouseDown({ button: 0, point: { x: 2100, y: 2200 } });

        controller.handleMouseMove({ point: { x: 3100, y: 4200 } });
        controller.handleMouseMove({ point: { x: 3100, y: 4200 } });

        expect(column.position).toEqual({ x: 3000, y: 4000 });
        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
        expect(controller.scheduleCanvasRender).toHaveBeenCalledTimes(1);
    });

    it('moves a wall perpendicular to its axis and keeps its neighboring endpoint connected', () => {
        const { engine, wall, neighbor } = setup();
        const controller = controllerFor(engine, wall);
        controller.handleMouseDown({ button: 0, point: { x: 500, y: 0 } });
        controller.handleMouseMove({ point: { x: 700, y: 200 } });

        expect(wall.start).toEqual({ x: 0, y: 200 });
        expect(wall.end).toEqual({ x: 1000, y: 200 });
        expect(neighbor.start).toEqual(wall.end);
        expect(neighbor.end).toEqual({ x: 1000, y: 1000 });
        expect(controller.selectionTool.drag.moved).toBe(true);
        expect(controller.scheduleCanvasRender).toHaveBeenCalledTimes(1);
        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
    });

    it('leaves the drawing unchanged and skips redraw when dragging would collapse a neighbor', () => {
        const { engine, wall, neighbor } = setup();
        const controller = controllerFor(engine, wall);
        controller.handleMouseDown({ button: 0, point: { x: 500, y: 0 } });
        controller.handleMouseMove({ point: { x: 500, y: 1000 } });

        expect(wall.start).toEqual({ x: 0, y: 0 });
        expect(neighbor.start).toEqual({ x: 1000, y: 0 });
        expect(controller.scheduleCanvasRender).not.toHaveBeenCalled();
        expect(engine.onModelChange).not.toHaveBeenCalled();
    });

    it('groups both endpoints when the same neighboring wall shares both junctions', () => {
        const { engine, wall } = setup();
        const reverse = new Wall({ start: wall.end, end: wall.start });
        engine.elements = [wall, reverse];
        const controller = controllerFor(engine, wall);
        controller.handleMouseDown({ button: 0, point: { x: 500, y: 0 } });
        controller.handleMouseMove({ point: { x: 500, y: 200 } });

        expect(reverse.start).toEqual(wall.end);
        expect(reverse.end).toEqual(wall.start);
        expect(reverse.getLength()).toBe(1000);
        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
    });
});
