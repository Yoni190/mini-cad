import { describe, it, expect } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import Wall from '../models/Wall';
import GeometryService from '../GeometryService';

describe('DrawingEngine wall display geometry', () => {
    it('preserves joins at both ends of a middle wall', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 },
            thickness: 200
        });

        const wallB = new Wall({
            start: { x: 4000, y: 0 },
            end: { x: 4000, y: 3000 },
            thickness: 200
        });

        const wallC = new Wall({
            start: { x: 4000, y: 3000 },
            end: { x: 8000, y: 3000 },
            thickness: 200
        });

        // This test only calculates geometry; it doesn't render.
        const engine = new DrawingEngine(null);
        engine.elements = [wallA, wallB, wallC];

        const geometry = engine.getWallDisplayGeometry();
        const middleWallCorners = geometry.get(wallB.id);

        // Join between wall A's end and wall B's start.
        expect(middleWallCorners[3]).toEqual({
            x: 3800,
            y: 200
        });

        // Join between wall B's end and wall C's start.
        expect(middleWallCorners[2]).toEqual({
            x: 3800,
            y: 3200
        });

        // Display joins must not alter the measured lengths.
        expect(wallA.getLength()).toBe(4000);
        expect(wallB.getLength()).toBe(3000);
        expect(wallC.getLength()).toBe(4000);
    });

    it('assigns joined corners to the correct walls in reverse order', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 },
            thickness: 200
        });

        const wallB = new Wall({
            start: { x: 4000, y: 0 },
            end: { x: 4000, y: 3000 },
            thickness: 200
        });

        const engine = new DrawingEngine(null);

        engine.elements = [wallA, wallB];
        const forward = engine.getWallDisplayGeometry();

        engine.elements = [wallB, wallA];
        const reverse = engine.getWallDisplayGeometry();

        expect(reverse.get(wallA.id)).toEqual(forward.get(wallA.id));
        expect(reverse.get(wallB.id)).toEqual(forward.get(wallB.id));
    });
});

describe('DrawingEngine wall junctions', () => {

    it('keeps three-way junction geometry independent of wall order', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 },
            thickness: 200
        });

        const wallB = new Wall({
            start: { x: 4000, y: 0 },
            end: { x: 4000, y: 3000 },
            thickness: 200
        });

        const wallC = new Wall({
            start: { x: 4000, y: 0 },
            end: { x: 7000, y: 3000 },
            thickness: 200
        });

        // No Canvas renderer is needed for geometry resolution.
        const engine = new DrawingEngine(null);

        engine.elements = [wallA, wallB, wallC];
        const geometry1 = engine.getWallDisplayGeometry();

        // Change the ordering of the same walls.
        engine.elements = [wallC, wallA, wallB];
        const geometry2 = engine.getWallDisplayGeometry();

        // The resulting footprints must be identical.
        for (const wall of [wallA, wallB, wallC]) {
            expect(geometry1.get(wall.id))
                .toEqual(geometry2.get(wall.id));
        }

        // At the unsupported branch, preserve original
        // rectangular footprints.
        for (const wall of [wallA, wallB, wallC]) {
            expect(geometry1.get(wall.id))
                .toEqual(wall.getGeometry());
        }
    });

    it('keeps four-way junction geometry independent of wall order', () => {
        const walls = [
            new Wall({
                start: { x: 0, y: 0 },
                end: { x: 4000, y: 0 }
            }),
            new Wall({
                start: { x: 4000, y: 0 },
                end: { x: 8000, y: 0 }
            }),
            new Wall({
                start: { x: 4000, y: 0 },
                end: { x: 4000, y: 3000 }
            }),
            new Wall({
                start: { x: 4000, y: 0 },
                end: { x: 4000, y: -3000 }
            })
        ];

        const engine = new DrawingEngine(null);

        engine.elements = walls;
        const geometry1 = engine.getWallDisplayGeometry();

        engine.elements = [...walls].reverse();
        const geometry2 = engine.getWallDisplayGeometry();

        for (const wall of walls) {
            expect(geometry1.get(wall.id))
                .toEqual(geometry2.get(wall.id));

            expect(geometry1.get(wall.id))
                .toEqual(wall.getGeometry());
        }
    });

    it('still resolves an ordinary two-wall L junction', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 },
            thickness: 200
        });

        const wallB = new Wall({
            start: { x: 4000, y: 0 },
            end: { x: 4000, y: 3000 },
            thickness: 200
        });

        const engine = new DrawingEngine(null);

        engine.elements = [wallA, wallB];

        const geometry = engine.getWallDisplayGeometry();

        expect(geometry.get(wallA.id)[2]).toEqual({
            x: 3800,
            y: 200
        });

        expect(geometry.get(wallB.id)[3]).toEqual({
            x: 3800,
            y: 200
        });
    });


    it('rejects conflicting joins that create an invalid middle wall', () => {
        const wallA = new Wall({
            start: { x: 0, y: 3000 },
            end: { x: 0, y: 0 },
            thickness: 200
        });

        const wallB = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 300, y: 0 },
            thickness: 200
        });

        const wallC = new Wall({
            start: { x: 300, y: 0 },
            end: { x: 300, y: 3000 },
            thickness: 200
        });

        const engine = new DrawingEngine(null);

        engine.elements = [wallA, wallB, wallC];

        const geometry = engine.getWallDisplayGeometry();

        // Every final polygon must be valid.
        for (const wall of [wallA, wallB, wallC]) {
            expect(
                GeometryService.isSimplePolygon(
                    geometry.get(wall.id)
                )
            ).toBe(true);
        }

        // Both joins conflict, so the safe fallback
        // leaves the original rectangular footprints.
        for (const wall of [wallA, wallB, wallC]) {
            expect(geometry.get(wall.id))
                .toEqual(wall.getGeometry());
        }

        // Original lengths remain unchanged.
        expect(wallA.getLength()).toBe(3000);
        expect(wallB.getLength()).toBe(300);
        expect(wallC.getLength()).toBe(3000);

        // Ensure changing the order does not change the result
        engine.elements = [wallC, wallB, wallA];

        const reversedGeometry = engine.getWallDisplayGeometry();

        for (const wall of [wallA, wallB, wallC]) {
            expect(reversedGeometry.get(wall.id))
                .toEqual(geometry.get(wall.id));
        }
    });

});