import { describe, expect, it } from 'vitest';
import GeometryService from '../GeometryService';
import Wall from '../models/Wall';
import Column from '../models/Column';

describe('resolveWallThicknessSide', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 1000, y: 0 };

    it('defaults to side 1 for the first wall', () => {
        expect(GeometryService.resolveWallThicknessSide(start, end, [])).toBe(1);
    });

    it('uses the supplied fallback when no wall shares an endpoint', () => {
        const unrelated = new Wall({
            start: { x: 2000, y: 0 },
            end: { x: 3000, y: 0 },
        });
        const crossing = new Wall({
            start: { x: 500, y: -1000 },
            end: { x: 500, y: 1000 },
        });
        const column = new Column({ position: start });

        expect(GeometryService.resolveWallThicknessSide(
            start, end, [unrelated, crossing, column], -1
        )).toBe(-1);
    });

    it('uses the fallback when the new wall has no direction', () => {
        expect(GeometryService.resolveWallThicknessSide(start, start, [], -1)).toBe(-1);
    });

    it.each([
        { side: 1, reversed: false, expected: 1 },
        { side: -1, reversed: false, expected: -1 },
        { side: 1, reversed: true, expected: -1 },
        { side: -1, reversed: true, expected: 1 },
    ])('preserves the physical face: side=$side, reversed=$reversed', ({ side, reversed, expected }) => {
        const neighbor = new Wall({
            start: { x: -1000, y: 0 },
            end: start,
            thicknessSide: side,
        });
        const newStart = reversed ? end : start;
        const newEnd = reversed ? start : end;
        const thicknessSide = GeometryService.resolveWallThicknessSide(
            newStart, newEnd, [neighbor]
        );
        const wall = new Wall({ start: newStart, end: newEnd, thicknessSide });

        expect(thicknessSide).toBe(expected);
        // Check the visible face as well as the sign: reversing the drawing
        // direction must keep the offset edge at the same physical Y position.
        expect(wall.getGeometry().slice(2).map(point => point.y)).toEqual([
            200 * side, 200 * side,
        ]);
    });

    it('preserves the physical face for a diagonal continuation drawn in reverse', () => {
        const neighbor = new Wall({
            start: { x: -300, y: -400 },
            end: start,
        });
        const wallStart = { x: 300, y: 400 };
        const thicknessSide = GeometryService.resolveWallThicknessSide(
            wallStart, start, [neighbor]
        );
        const wall = new Wall({ start: wallStart, end: start, thicknessSide });

        expect(thicknessSide).toBe(-1);
        expect(wall.getGeometry()[2]).toEqual(neighbor.getGeometry()[2]);
    });

    const cornerCases = [
        { connection: 'start to end', from: { x: 0, y: -1000 }, to: start, expected: 1 },
        { connection: 'end to start', from: end, to: { x: 1000, y: 1000 }, expected: 1 },
        { connection: 'start to start', from: start, to: { x: 0, y: 1000 }, expected: -1 },
        { connection: 'end to end', from: { x: 1000, y: -1000 }, to: end, expected: -1 },
    ];

    describe.each([1, -1])('corner neighbor with side %s', side => {
        it.each(cornerCases)('orients the boundary at $connection', ({ from, to, expected }) => {
            const neighbor = new Wall({ start: from, end: to, thicknessSide: side });

            expect(GeometryService.resolveWallThicknessSide(
                start, end, [neighbor]
            )).toBe(expected * side);
        });
    });

    it.each([false, true])('prioritizes a straight neighbor over a corner (reordered=%s)', reordered => {
        const straight = new Wall({
            start: { x: -1000, y: 0 }, end: start, thicknessSide: -1,
        });
        const corner = new Wall({ start: end, end: { x: 1000, y: 1000 } });
        const neighbors = reordered ? [corner, straight] : [straight, corner];

        expect(GeometryService.resolveWallThicknessSide(start, end, neighbors)).toBe(-1);
    });

    it('accepts straight neighbors agreeing on the physical side despite opposite directions', () => {
        const before = new Wall({ start: { x: -1000, y: 0 }, end: start });
        const after = new Wall({
            start: { x: 2000, y: 0 }, end, thicknessSide: -1,
        });

        expect(GeometryService.resolveWallThicknessSide(
            start, end, [before, after], -1
        )).toBe(1);
    });

    it.each([1, -1])('uses fallback %s when straight neighbors disagree, even with a corner', fallback => {
        const before = new Wall({ start: { x: -1000, y: 0 }, end: start });
        const after = new Wall({ start: end, end: { x: 2000, y: 0 }, thicknessSide: -1 });
        const corner = new Wall({ start: end, end: { x: 1000, y: 1000 } });

        expect(GeometryService.resolveWallThicknessSide(
            start, end, [before, after, corner], fallback
        )).toBe(fallback);
    });

    it('uses the fallback for multiple corner neighbors even when they suggest the same side', () => {
        const before = new Wall({ start: { x: 0, y: -1000 }, end: start });
        const after = new Wall({ start: end, end: { x: 1000, y: 1000 } });

        expect(GeometryService.resolveWallThicknessSide(
            start, end, [before, after], -1
        )).toBe(-1);
    });

    it.each([
        { gap: 0.0000005, expected: -1 },
        { gap: 0.000002, expected: 1 },
    ])('handles endpoint gaps of $gap mm', ({ gap, expected }) => {
        const neighbor = new Wall({
            start: { x: -1000, y: 0 },
            end: { x: -gap, y: 0 },
            thicknessSide: -1,
        });

        expect(GeometryService.resolveWallThicknessSide(start, end, [neighbor])).toBe(expected);
    });
});
