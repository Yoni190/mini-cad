import { afterEach, describe, expect, it, vi } from 'vitest';
import EditorController from '../EditorController';

afterEach(() => vi.unstubAllGlobals());

describe('wall chain completion', () => {
    it('finishes a new chain when it reconnects through existing walls', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 1000, y: 0 };
        const c = { x: 1000, y: 1000 };
        const d = { x: 0, y: 1000 };
        const elements = [
            { type: 'wall', start: a, end: b },
            { type: 'wall', start: b, end: c },
        ];
        const engine = {
            elements, startPoint: a,
            addWall(start, end) { elements.push({ type: 'wall', start, end }); },
        };
        const controller = new EditorController(null, engine, null, null, null);
        controller.wallChainStart = a;
        const inputs = { newWallThickness: { value: '200', checkValidity: () => true }, wallLength: { value: '' } };
        vi.stubGlobal('document', { getElementById: id => inputs[id] });

        controller.commitWall(d);
        expect(engine.startPoint).toEqual(d);
        controller.commitWall(c);

        expect(elements).toHaveLength(4);
        expect(engine.startPoint).toBeNull();
        expect(controller.wallChainStart).toBeNull();
    });
});
