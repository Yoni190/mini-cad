import { describe, expect, it, vi } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import Wall from '../models/Wall';
import Column from '../models/Column';

function setup() {
    const engine = new DrawingEngine(null);
    const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } });
    const column = new Column({ position: { x: 2000, y: 2000 } });
    engine.elements = [wall, column];
    engine.render = vi.fn();
    engine.onModelChange = vi.fn();
    const cached = engine.getWallDisplayGeometry();
    return { engine, wall, column, cached };
}

describe('model change lifecycle', () => {
    it('can invalidate derived geometry without reporting a model change or redrawing', () => {
        const { engine, cached } = setup();

        engine.invalidateWallGeometry();

        expect(engine.onModelChange).not.toHaveBeenCalled();
        expect(engine.render).not.toHaveBeenCalled();
        expect(engine.getWallDisplayGeometry()).not.toBe(cached);
        expect(engine.getWallDisplayGeometry()).toEqual(cached);
    });

    const wallChanges = [
        {
            name: 'adding a wall',
            change: ({ engine }) => engine.addWall({ x: 3000, y: 0 }, { x: 4000, y: 0 }),
            verify: (geometry) => expect(geometry.size).toBe(2),
        },
        {
            name: 'changing wall thickness',
            change: ({ engine, wall }) => engine.updateWallThickness(wall.id, 400),
            verify: (geometry, { wall }) => expect(geometry.get(wall.id)[2]).toEqual({ x: 1000, y: 400 }),
        },
        {
            name: 'moving wall endpoints',
            change: ({ engine, wall }) => engine.updateWallEndpoints([
                { id: wall.id, start: { x: 0, y: 200 }, end: { x: 1000, y: 200 } },
            ]),
            verify: (geometry, { wall }) => expect(geometry.get(wall.id)[0]).toEqual({ x: 0, y: 200 }),
        },
        {
            name: 'removing a wall',
            change: ({ engine, wall }) => engine.removeElement(wall.id),
            verify: (geometry, { wall }) => expect(geometry.has(wall.id)).toBe(false),
        },
        {
            name: 'replacing the drawing',
            change: ({ engine }) => engine.replaceElements([]),
            verify: (geometry) => expect(geometry.size).toBe(0),
        },
    ];

    it.each(wallChanges)('makes fresh geometry available inside the notification when $name', ({ change, verify }) => {
        const state = setup();
        const { engine, cached } = state;
        engine.onModelChange.mockImplementation(() => {
            // The 3D view can synchronously request geometry during this callback.
            const geometry = engine.getWallDisplayGeometry();
            expect(geometry).not.toBe(cached);
            verify(geometry, state);
            expect(engine.render).not.toHaveBeenCalled();
        });

        change(state);

        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
    });

    const columnChanges = [
        {
            name: 'adding a column',
            change: ({ engine }) => engine.addColumn({ x: 3000, y: 3000 }),
            verify: ({ engine }) => expect(engine.elements.filter(e => e.type === 'column')).toHaveLength(2),
        },
        {
            name: 'moving a column',
            change: ({ engine, column }) => engine.moveColumn(column.id, { x: 3000, y: 4000 }),
            verify: ({ column }) => expect(column.position).toEqual({ x: 3000, y: 4000 }),
        },
        {
            name: 'resizing a column',
            change: ({ engine, column }) => engine.updateColumnDimensions(column.id, 600, 800),
            verify: ({ column }) => expect([column.width, column.depth]).toEqual([600, 800]),
        },
        {
            name: 'removing a column',
            change: ({ engine, column }) => engine.removeElement(column.id),
            verify: ({ engine, column }) => expect(engine.elements).not.toContain(column),
        },
    ];

    it.each(columnChanges)('reports committed data while reusing wall geometry when $name', ({ change, verify }) => {
        const state = setup();
        const { engine, cached } = state;
        engine.onModelChange.mockImplementation(() => {
            verify(state);
            expect(engine.getWallDisplayGeometry()).toBe(cached);
            expect(engine.render).not.toHaveBeenCalled();
        });

        change(state);

        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
    });

    it('does not notify or redraw for unchanged dimensions, unchanged thickness or a missing deletion', () => {
        const { engine, wall, column, cached } = setup();

        engine.updateWallThickness(wall.id, wall.thickness);
        engine.updateColumnDimensions(column.id, column.width, column.depth);
        engine.removeElement('missing');

        expect(engine.onModelChange).not.toHaveBeenCalled();
        expect(engine.render).not.toHaveBeenCalled();
        expect(engine.getWallDisplayGeometry()).toBe(cached);
    });
});
