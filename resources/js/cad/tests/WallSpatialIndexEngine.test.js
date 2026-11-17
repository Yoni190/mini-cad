import { describe, expect, it } from 'vitest';
import DrawingEngine from '../DrawingEngine';
import Wall from '../models/Wall';

describe('DrawingEngine wall spatial index', () => {
    it('updates candidates when a wall moves or is deleted', () => {
        const engine = new DrawingEngine();
        const wall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 500, y: 0 }
        });

        engine.replaceElements([wall]);

        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).toContain(wall);

        engine.moveElements([wall], 5000, 0);

        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).not.toContain(wall);
        expect(engine.findWallsNear({ x: 5000, y: 0 }, 10)).toContain(wall);

        engine.removeElements([wall.id]);

        expect(engine.findWallsNear({ x: 5000, y: 0 }, 10)).not.toContain(wall);
    });

    it('updates candidates when wall endpoints change', () => {
        const engine = new DrawingEngine();
        const wall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 500, y: 0 }
        });

        engine.replaceElements([wall]);
        engine.findWallsNear({ x: 0, y: 0 }, 10);

        engine.updateWallEndpoints([{
            id: wall.id,
            start: { x: 5000, y: 0 },
            end: { x: 5500, y: 0 }
        }]);

        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).not.toContain(wall);
        expect(engine.findWallsNear({ x: 5000, y: 0 }, 10)).toContain(wall);
    });

    it('updates candidates after undo and redo', () => {
        const engine = new DrawingEngine();

        engine.addWall({ x: 0, y: 0 }, { x: 500, y: 0 });
        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).toHaveLength(1);

        engine.undo();
        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).toHaveLength(0);

        engine.redo();
        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).toHaveLength(1);
    });

    it('updates candidates when a drawing is replaced', () => {
        const engine = new DrawingEngine();
        const oldWall = new Wall({
            start: { x: 0, y: 0 },
            end: { x: 500, y: 0 }
        });
        const newWall = new Wall({
            start: { x: 5000, y: 0 },
            end: { x: 5500, y: 0 }
        });

        engine.replaceElements([oldWall]);
        engine.findWallsNear({ x: 0, y: 0 }, 10);

        engine.replaceElements([newWall]);

        expect(engine.findWallsNear({ x: 0, y: 0 }, 10)).not.toContain(oldWall);
        expect(engine.findWallsNear({ x: 5000, y: 0 }, 10)).toContain(newWall);
    });
});