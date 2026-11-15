import { describe, expect, it } from 'vitest';
import WallTopology from '../geometry/WallTopology';
import Wall from '../models/Wall';
import Column from '../models/Column';

const a = { x: 0, y: 0 };
const b = { x: 1000, y: 0 };
const c = { x: 1000, y: 1000 };
const wall = (start, end) => new Wall({ start, end });

describe('WallTopology.hasPath', () => {
    it('finds an existing route regardless of wall direction', () => {
        const elements = [wall(b, a), wall(c, b)];
        expect(WallTopology.hasPath(elements, a, c)).toBe(true);
        expect(WallTopology.hasPath(elements, c, a)).toBe(true);
    });

    it('returns false for empty geometry or disconnected endpoints', () => {
        expect(WallTopology.hasPath([], a, c)).toBe(false);
        expect(WallTopology.hasPath([wall(a, b)], a, c)).toBe(false);
    });

    it('requires at least two segments rather than a single connecting wall', () => {
        expect(WallTopology.hasPath([wall(a, b)], a, b)).toBe(false);
    });

    it('connects proposed endpoints inside existing walls by temporary splitting', () => {
        const elements = [wall(a, b), wall(b, c)];
        expect(WallTopology.hasPath(elements, { x: 500, y: 0 }, { x: 1000, y: 500 })).toBe(true);
    });

    it('recognizes intersections inside walls', () => {
        const elements = [
            wall(a, { x: 2000, y: 0 }),
            wall({ x: 1000, y: -1000 }, c),
        ];
        expect(WallTopology.hasPath(elements, a, c)).toBe(true);
    });

    it('preserves drafting tolerance for endpoints close to the source geometry', () => {
        const elements = [wall(a, b), wall(b, c)];
        expect(WallTopology.hasPath(elements, { x: 0, y: 0.5e-6 }, c)).toBe(true);
        expect(WallTopology.hasPath(elements, { x: 0, y: 2e-6 }, c)).toBe(false);
    });

    it('terminates for a closed loop with an unreachable destination', () => {
        const elements = [wall(a, b), wall(b, c), wall(c, a)];
        expect(WallTopology.hasPath(elements, a, { x: 5000, y: 5000 })).toBe(false);
    });

    it('does not change source elements, IDs, endpoint objects, or query points', () => {
        const elements = [wall(a, b), wall(b, c), new Column({ position: { x: 5000, y: 5000 } })];
        const before = JSON.stringify(elements);
        const references = [...elements];
        const endpoints = elements.slice(0, 2).map(w => [w.start, w.end]);
        const start = Object.freeze({ x: 500, y: 0 });
        const end = Object.freeze({ x: 1000, y: 500 });
        elements.forEach(element => {
            if (element.type === 'wall') {
                Object.freeze(element.start);
                Object.freeze(element.end);
            }
            Object.freeze(element);
        });
        Object.freeze(elements);
        expect(WallTopology.hasPath(elements, start, end)).toBe(true);
        expect(JSON.stringify(elements)).toBe(before);
        references.forEach((element, index) => expect(elements[index]).toBe(element));
        endpoints.forEach(([start, end], index) => {
            expect(elements[index].start).toBe(start);
            expect(elements[index].end).toBe(end);
        });
    });

    it('propagates splitting errors for overlapping walls', () => {
        const elements = [wall(a, b), wall({ x: 500, y: 0 }, { x: 1500, y: 0 })];
        expect(() => WallTopology.hasPath(elements, a, c)).toThrow('Overlapping walls are not supported.');
    });
});
