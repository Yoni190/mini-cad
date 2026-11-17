import { describe, expect, it } from 'vitest';
import WallSpatialIndex from '../geometry/WallSpatialIndex';

describe('WallSpatialIndex', () => {
    it('finds nearby walls across negative coordinates and cell boundaries', () => {
        const first = {
            start: { x: -1100, y: 0 },
            end: { x: -900, y: 0 }
        };
        const distant = {
            start: { x: 5000, y: 0 },
            end: { x: 6000, y: 0 }
        };
        const second = {
            start: { x: -1000, y: -100 },
            end: { x: -1000, y: 100 }
        };

        const index = new WallSpatialIndex([first, distant, second]);

        expect(index.findNear({ x: -1000, y: 0 }, 10))
            .toEqual([first, second]);
    });

    it('returns each wall once when it covers multiple cells', () => {
        const wall = {
            start: { x: -1000, y: 0 },
            end: { x: 1000, y: 0 }
        };

        const index = new WallSpatialIndex([wall]);

        expect(index.findNear({ x: 0, y: 0 }, 1000)).toEqual([wall]);
    });

    it('falls back to all walls for a very large wall', () => {
        const walls = [{
            start: { x: 0, y: 0 },
            end: { x: 2000000, y: 2000000 }
        }];

        const index = new WallSpatialIndex(walls);

        expect(index.findNear({ x: 0, y: 0 }, 10)).toEqual(walls);
    });

    it('falls back to all walls for a very large search area', () => {
        const walls = [{
            start: { x: 5000, y: 0 },
            end: { x: 6000, y: 0 }
        }];

        const index = new WallSpatialIndex(walls);

        expect(index.findNear({ x: 0, y: 0 }, 100000)).toEqual(walls);
    });
});