import { describe, expect, it } from 'vitest';
import restoreElements from '../persistence/restoreElements';
import Wall from '../models/Wall';
import Column from '../models/Column';

describe('restoring saved drawing elements', () => {
    it('restores model methods, ids and dimensions from JSON without changing the source', () => {
        const wall = new Wall({ start: { x: 0, y: 0 }, end: { x: 3000, y: 4000 }, thicknessSide: -1 });
        const column = new Column({ position: { x: 1000, y: 2000 }, width: 600 });
        const data = JSON.parse(JSON.stringify([wall, column]));
        const before = JSON.stringify(data);
        const restored = restoreElements(data);

        expect(restored[0]).toBeInstanceOf(Wall);
        expect(restored[1]).toBeInstanceOf(Column);
        expect(restored[0].id).toBe(wall.id);
        expect(restored[0].getLength()).toBe(5000);
        expect(restored[0].thicknessSide).toBe(-1);
        expect(restored[1].getGeometry()).toEqual(column.getGeometry());
        expect(JSON.stringify(data)).toBe(before);
        expect(restored[0].start).not.toBe(data[0].start);
    });

    it('restores empty projects', () => {
        expect(restoreElements([])).toEqual([]);
    });

    it.each([null, {}, [{ type: 'unknown' }], [null], [
        { type: 'wall', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
    ]])('rejects invalid saved data %j', data => {
        expect(() => restoreElements(data)).toThrow();
    });
});
