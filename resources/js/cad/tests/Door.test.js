import { describe, expect, it } from 'vitest';
import DrawingEngine from '../DrawingEngine';

function createWall() {
    const engine = new DrawingEngine();

    engine.addWall(
        { x: 0, y: 0 },
        { x: 4000, y: 0 }
    );

    return {
        engine,
        wallId: engine.elements[0].id,
    };
}

describe('doors', () => {
    it.each([0, -1])('rejects door and window heights of %s without changing the drawing', height => {
        const { engine, wallId } = createWall();

        expect(() => engine.addDoor(wallId, 1000, 900, height)).toThrow('Invalid wall opening.');
        expect(() => engine.addWindow(wallId, 1000, 900, height, 900)).toThrow('Invalid wall opening.');
        expect(engine.elements[0].openings).toEqual([]);
    });

    it('adds a door and supports undo and redo', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 1000, 900, 2100);

        expect(engine.elements[0].openings).toEqual([
            { offset: 1000, width: 900, height: 2100, swingSide: 1 },
        ]);

        engine.undo();
        expect(engine.elements[0].openings).toEqual([]);

        engine.redo();
        expect(engine.elements[0].openings).toEqual([
            { offset: 1000, width: 900, height: 2100, swingSide: 1 },
        ]);
    });

    it('rejects overlapping doors and doors outside the wall', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 1000, 900, 2100);

        expect(() => engine.addDoor(wallId, 1500, 900, 2100))
            .toThrow();

        expect(() => engine.addDoor(wallId, 3500, 900, 2100))
            .toThrow();

        expect(engine.elements[0].openings).toHaveLength(1);
    });

    it('removes a door and restores it with undo', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 1000, 900, 2100);
        engine.removeDoor(wallId, 0);

        expect(engine.elements[0].openings).toEqual([]);

        engine.undo();

        expect(engine.elements[0].openings).toEqual([
            { offset: 1000, width: 900, height: 2100, swingSide: 1 },
        ]);
    });

    it('keeps a door when another wall splits its wall elsewhere', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 2500, 900, 2100);

        engine.addWall(
            { x: 2000, y: 0 },
            { x: 2000, y: 2000 }
        );

        const pieceWithDoor = engine.elements.find(
            element => element.type === 'wall' && element.openings.length > 0
        );

        expect(pieceWithDoor.start).toEqual({ x: 2000, y: 0 });
        expect(pieceWithDoor.openings).toEqual([
            { offset: 500, width: 900, height: 2100, swingSide: 1 },
        ]);
    });

    it('keeps the chosen swing side through undo and redo', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 1000, 900, 2100, -1);

        expect(engine.elements[0].openings[0].swingSide).toBe(-1);

        engine.undo();
        engine.redo();

        expect(engine.elements[0].openings[0].swingSide).toBe(-1);
    });

    it('rejects a wall that would split through a door', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 1000, 900, 2100);

        expect(() => engine.addWall(
            { x: 1400, y: 0 },
            { x: 1400, y: 2000 }
        )).toThrow('A wall cannot split through a door.');

        expect(engine.elements).toHaveLength(1);
        expect(engine.elements[0].openings).toHaveLength(1);
    });

    it('rejects a wall height lower than its door', () => {
        const { engine, wallId } = createWall();

        engine.addDoor(wallId, 1000, 900, 2100);

        expect(() => engine.updateWallHeight(wallId, 2000))
            .toThrow('Wall height cannot be less than the top of an opening.');

        expect(engine.elements[0].height).toBe(3000);
    });
});
