
import { describe, it, expect } from 'vitest';
import Wall from '../models/Wall';
import GeometryService from '../GeometryService';

describe('Wall Geometry', () => {

    it('calculates the correct length of a diagonal wall', () => {
        const wall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 3000, y: 4000 }
        });

        expect(wall.getLength()).toBe(5000);
    });

    it('rejects walls with identical endpoints', () => {
        expect(() => {
            new Wall({
                start: { x: 1000, y: 1000 },
                end: { x: 1000, y: 1000 }
            });
        }).toThrow();
    });

    it('calculates the correct wall corner coordinates', () => {
        const wall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 },
            thickness: 200
        });

        expect(wall.getGeometry()).toEqual(
            [
                { x: 0, y: 0 },
                { x: 4000, y: 0 },
                { x: 4000, y: 200 },
                { x: 0, y: 200 }
            ],
        );
    });

    it('detects walls sharing an endpoint', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        const wallB = new Wall({
            start: { x: 4000, y: 0 },
            end: { x: 4000, y: 3000 }
        });

        expect(
            GeometryService.areWallsConnected(wallA, wallB)
        ).toBe(true);
    });

    it('detects walls not sharing an endpoint', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        const wallB = new Wall({
            start: { x: 4100, y: 0 },
            end: { x: 4100, y: 3000 }
        });

        expect(
            GeometryService.areWallsConnected(wallA, wallB)
        ).toBe(false);
    });

    it('detects walls as connected when endpoints are within tolerance', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        const wallB = new Wall({
            start: { x: 4000.5, y: 0 },
            end: { x: 4000.5, y: 3000 }
        });

        expect(
            GeometryService.areWallsConnected(wallA, wallB, 1)
        ).toBe(true);
    });
    
    it('detects walls as disconnected when endpoints are outside tolerance', () => {
        const wallA = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 4000, y: 0 }
        });

        const wallB = new Wall({
            start: { x: 4000.5, y: 0 },
            end: { x: 4000.5, y: 3000 }
        });

        expect(
            GeometryService.areWallsConnected(wallA, wallB, 0.1)
        ).toBe(false);
    });

    it('calculates an L-shaped junction without modifying wall lengths', () => {
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

        const result = GeometryService.getJoinedWallCorners(
            wallA,
            wallB
        );

        // Verify the calculated outer corner
        expect(result.wallACorners[2]).toEqual({
            x: 3800,
            y: 200
        });

        expect(result.wallBCorners[3]).toEqual({
            x: 3800,
            y: 200
        });

        // Verify original measured lengths remain unchanged
        expect(wallA.getLength()).toBe(4000);
        expect(wallB.getLength()).toBe(3000);

        // Verify that original coordinates remain unchanged
        expect(wallA.end).toEqual({ x: 4000, y: 0 });
        expect(wallB.start).toEqual({ x: 4000, y: 0 });
    });
});