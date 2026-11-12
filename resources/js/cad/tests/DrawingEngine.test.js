import { describe, it, expect } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import Wall from '../models/Wall';

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