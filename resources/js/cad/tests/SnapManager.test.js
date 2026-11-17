
import { describe, it, expect } from 'vitest';
import SnapManager from '../interaction/SnapManager';
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

    it('prefers an endpoint over a closer point on a wall', () => {
        const snapManager = new SnapManager();

        const endpointWall = new Wall({
            start: { x: 30, y: 0 },
            end: { x: 30, y: 100 }
        });

        const nearbyWall = new Wall({
            start: { x: -100, y: 5 },
            end: { x: 100, y: 5 }
        });

        const result = snapManager.snap(
            { x: 0, y: 0 },
            [endpointWall, nearbyWall],
            50
        );

        expect(result).toEqual({ x: 30, y: 0 });
    });

    it('keeps the first endpoint when distances are equal', () => {
        const snapManager = new SnapManager();

        const firstWall = new Wall({
            start: { x: -20, y: 0 },
            end: { x: -20, y: 100 }
        });

        const secondWall = new Wall({
            start: { x: 20, y: 0 },
            end: { x: 20, y: 100 }
        });

        const result = snapManager.snap(
            { x: 0, y: 0 },
            [firstWall, secondWall],
            50
        );

        expect(result).toEqual({ x: -20, y: 0 });
    });

    it('snaps to a wall intersection on the constrained axis', () => {
        const snapManager = new SnapManager();

        const wall = new Wall({
            start: { x: -100, y: 20 },
            end: { x: 100, y: 20 }
        });

        const result = snapManager.snap(
            { x: 0, y: 0 },
            [wall],
            50,
            { axis: 'x', value: 0 }
        );

        expect(result).toEqual({ x: 0, y: 20 });
    });

    it('detects whether a point lies on a wall', () => {
        const snapManager = new SnapManager();

        const wall = new Wall({
            start: { x: -100, y: 0 },
            end: { x: 100, y: 0 }
        });

        expect(snapManager.isOnWall({ x: 0, y: 0 }, [wall])).toBe(true);
        expect(snapManager.isOnWall({ x: 0, y: 1 }, [wall])).toBe(false);
    });
});
