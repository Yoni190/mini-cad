
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

    it('snaps to the nearest endpoint', () => {
        const snapManager = new SnapManager();

        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        const wallB = new Wall({
            start: { x: 4100, y: 0 },
            end: { x: 4100, y: 3000 }
        });

        // Mouse is 70 mm from Wall A and 30 mm from Wall B
        const point = { x: 4070, y: 0 };

        const result = snapManager.snap(point, [wallA, wallB]);

        expect(result).toEqual({ x: 4100, y: 0 });
    })
});
