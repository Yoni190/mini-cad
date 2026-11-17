import { describe, expect, it } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import SnapManager from '../interaction/SnapManager';
import Wall from '../models/Wall';

describe('indexed snapping', () => {
    it('matches a full search for boundaries, constraints, and wall checks', () => {
        const engine = new DrawingEngine();
        const snapManager = new SnapManager();

        engine.replaceElements([
            new Wall({
                start: { x: -2000, y: -1000 },
                end: { x: 2000, y: -1000 }
            }),
            new Wall({
                start: { x: -1000, y: -2000 },
                end: { x: -1000, y: 2000 }
            }),
            new Wall({
                start: { x: -5000, y: -5000 },
                end: { x: 5000, y: 5000 }
            }),
            new Wall({
                start: { x: 20, y: 0 },
                end: { x: 20, y: 500 }
            }),
            new Wall({
                start: { x: -20, y: 0 },
                end: { x: -20, y: 500 }
            })
        ]);

        const points = [
            { x: 0, y: 0 },
            { x: -1000, y: -1000 },
            { x: -1000.000001, y: 500 },
            { x: 999.999999, y: 1000 },
            { x: 3000, y: 3001 },
            { x: 9000, y: 9000 }
        ];

        for (const point of points) {
            for (const tolerance of [10, 50, 150]) {
                const candidates = engine.findWallsNear(point, tolerance);
                const constraints = [
                    null,
                    { axis: 'x', value: point.x },
                    { axis: 'y', value: point.y }
                ];

                for (const constraint of constraints) {
                    expect(
                        snapManager.snap(point, candidates, tolerance, constraint)
                    ).toEqual(
                        snapManager.snap(point, engine.elements, tolerance, constraint)
                    );
                }
            }

            expect(
                snapManager.isOnWall(point, engine.findWallsNear(point, 1e-6))
            ).toBe(
                snapManager.isOnWall(point, engine.elements)
            );
        }
    });

    it('finds the new wall pieces after a wall is split', () => {
        const engine = new DrawingEngine();
        const point = { x: 1000, y: 0 };

        engine.addWall({ x: 0, y: 0 }, { x: 2000, y: 0 });
        engine.findWallsNear(point, 10);

        engine.addWall({ x: 1000, y: -1000 }, { x: 1000, y: 1000 });

        const candidates = engine.findWallsNear(point, 10);
        const snapManager = new SnapManager();

        expect(candidates).toHaveLength(4);
        expect(snapManager.snap(point, candidates, 10)).toEqual(
            snapManager.snap(point, engine.elements, 10)
        );
    });

    it('matches a full search when a long wall disables the grid', () => {
        const engine = new DrawingEngine();
        const snapManager = new SnapManager();
        const point = { x: 1000000, y: 1000001 };

        engine.replaceElements([
            new Wall({
                start: { x: 0, y: 0 },
                end: { x: 2000000, y: 2000000 }
            })
        ]);

        expect(
            snapManager.snap(point, engine.findWallsNear(point, 10), 10)
        ).toEqual(
            snapManager.snap(point, engine.elements, 10)
        );
    });
});