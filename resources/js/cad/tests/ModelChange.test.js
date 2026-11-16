import { describe, expect, it, vi } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import Wall from '../models/Wall';
import Column from '../models/Column';

function setup() {
    const engine = new DrawingEngine();
    const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } });
    const column = new Column({ position: { x: 2000, y: 2000 } });
    engine.elements = [wall, column];
    engine.onModelChange = vi.fn();
    const cached = engine.getWallDisplayGeometry();
    return { engine, wall, column, cached };
}

describe('model change lifecycle', () => {
    it('can invalidate derived geometry without reporting a model change or redrawing', () => {
        const { engine, cached } = setup();

        engine.invalidateWallGeometry();

        expect(engine.onModelChange).not.toHaveBeenCalled();
        expect(engine.getWallDisplayGeometry()).not.toBe(cached);
        expect(engine.getWallDisplayGeometry()).toEqual(cached);
    });

    it('validates wall height and reports actual changes', () => {
        const { engine, wall, cached } = setup();
        for (const value of ['', 0, -1, Infinity, 'invalid']) {
            expect(() => engine.updateWallHeight(wall.id, value)).toThrow('Wall height must be a positive number.');
        }
        engine.updateWallHeight(wall.id, '2800');
        expect(wall.height).toBe(2800);
        expect(engine.onModelChange).toHaveBeenCalledOnce();
        expect(engine.getWallDisplayGeometry()).toBe(cached);
        engine.updateWallHeight(wall.id, 2800);
        expect(engine.onModelChange).toHaveBeenCalledOnce();
    });

    it('updates column height and rejects invalid dimensions without partial changes', () => {
        const { engine, column } = setup();
        engine.updateColumnDimensions(column.id, column.width, column.depth, 3500);
        expect(column.height).toBe(3500);
        expect(engine.onModelChange).toHaveBeenCalledOnce();
        for (const height of [0, -1, Infinity, 'invalid']) {
            expect(() => engine.updateColumnDimensions(column.id, 600, 800, height)).toThrow('Column height must be a positive number');
        }
        expect([column.width, column.depth, column.height]).toEqual([400, 400, 3500]);
        expect(engine.onModelChange).toHaveBeenCalledOnce();
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
            change: ({ engine, wall }) => engine.removeElements([wall.id]),
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
            change: ({ engine, column }) => engine.updateColumnDimensions(column.id, 600, 800, 3500),
            verify: ({ column }) => expect([column.width, column.depth]).toEqual([600, 800]),
        },
        {
            name: 'removing a column',
            change: ({ engine, column }) => engine.removeElements([column.id]),
            verify: ({ engine, column }) => expect(engine.elements).not.toContain(column),
        },
    ];

    it.each(columnChanges)('reports committed data while reusing wall geometry when $name', ({ change, verify }) => {
        const state = setup();
        const { engine, cached } = state;
        engine.onModelChange.mockImplementation(() => {
            verify(state);
            expect(engine.getWallDisplayGeometry()).toBe(cached);
        });

        change(state);

        expect(engine.onModelChange).toHaveBeenCalledTimes(1);
    });

    it('removes a column group without recalculating wall footprints', () => {
        const { engine, wall, column, cached } = setup();
        engine.addColumn({ x: 4000, y: 4000 });
        const added = engine.elements.at(-1);
        engine.onModelChange.mockClear();
        engine.onModelChange.mockImplementation(() => {
            expect(engine.elements).toEqual([wall]);
            expect(engine.getWallDisplayGeometry()).toBe(cached);
        });

        engine.removeElements([column.id, added.id]);

        expect(engine.onModelChange).toHaveBeenCalledOnce();
    });

    it('does not notify or redraw for unchanged dimensions, unchanged thickness or a missing deletion', () => {
        const { engine, wall, column, cached } = setup();

        engine.updateWallThickness(wall.id, wall.thickness);
        engine.updateColumnDimensions(column.id, column.width, column.depth, column.height);
        engine.removeElements(['missing']);

        expect(engine.onModelChange).not.toHaveBeenCalled();
        expect(engine.getWallDisplayGeometry()).toBe(cached);
    });
});
