
import { describe, it, expect } from 'vitest';
import Wall from '../models/Wall';

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
});