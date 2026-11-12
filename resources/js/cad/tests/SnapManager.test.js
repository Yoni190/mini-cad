
import { describe, it, expect } from 'vitest';
import SnapManager from '../SnapManager';
import Wall from '../models/Wall';

describe('SnapManager', () => {
    it('snaps to a nearby wall endpoint', () => {
        const snapManager = new SnapManager();

        const wall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        // Mouse is 50 mm away from the endpoint
        const point = { x: 3950, y: 0 };

        const result = snapManager.snap(point, [wall]);

        expect(result).toEqual({ x: 4000, y: 0 });
    });

    it('does not snap when the point is outside the tolerance', () => {
        const snapManager = new SnapManager();

        const wall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        // Mouse is 200 mm away from the endpoint
        const point = { x: 3800, y: 0 };

        const result = snapManager.snap(point, [wall]);

        expect(result).toEqual({ x: 3800, y: 0 });
    });
});
