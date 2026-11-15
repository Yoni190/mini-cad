
import { describe, it, expect } from 'vitest';
import Wall from '../models/Wall';
import GeometryService from '../geometry/GeometryService';

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

    it('accepts a valid rectangular polygon', () => {
        const corners = [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 200 },
            { x: 0, y: 200 }
        ];

        expect(
            GeometryService.isSimplePolygon(corners)
        ).toBe(true);
    });

    it('rejects a self-intersecting polygon', () => {
        const corners = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: -100, y: 200 },
            { x: 0, y: 200 }
        ];

        expect(
            GeometryService.isSimplePolygon(corners)
        ).toBe(false);
    });

    it('keeps the inner-face reference when walls are drawn with thickness outward', () => {
        // Left wall: drawn downward
        const leftWall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 0, y: 3000 },
            thickness: 200
        });

        // Bottom wall: drawn toward the right
        const bottomWall = new Wall({
            start: { x: 0, y: 3000 },
            end: { x: 4000, y: 3000 },
            thickness: 200
        });

        const leftCorners = leftWall.getGeometry();
        const bottomCorners = bottomWall.getGeometry();

        // Left wall thickness extends outside to negative X.
        expect(leftCorners[2]).toEqual({
            x: -200,
            y: 3000
        });

        // Bottom wall thickness extends outside to positive Y.
        expect(bottomCorners[2]).toEqual({
            x: 4000,
            y: 3200
        });

        // The reference lengths represent the room's
        // intended internal dimensions.
        expect(leftWall.getLength()).toBe(3000);
        expect(bottomWall.getLength()).toBe(4000);
    });

});