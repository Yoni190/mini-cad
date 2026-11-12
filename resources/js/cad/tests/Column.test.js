import { describe, it, expect } from 'vitest';
import Column from '../models/Column';

describe('Column Geometry', () => {
    it('calculates column corners correctly', () => {
        const column = new Column({
            position: { x: 1000, y: 2000 },
            width: 400,
            depth: 600
        });

        expect(column.getGeometry()).toEqual([
            { x: 1000, y: 2000 },
            { x: 1400, y: 2000 },
            { x: 1400, y: 2600 },
            { x: 1000, y: 2600 }
        ]);
    });

    it('rejects columns with negative width', () => {
        expect(() => {
            new Column({
                position: { x: 1000, y: 2000 },
                width: -400,
                depth: 600
            });
        }).toThrow();
    });

    it('rejects columns with zero height', () => {
        expect(() => {
            new Column({
                position: { x: 1000, y: 2000 },
                width: 400,
                depth: 600,
                height: 0,
            });
        }).toThrow();
    });
});