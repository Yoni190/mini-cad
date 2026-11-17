import { expect, it } from 'vitest';
import Wall from '../models/Wall';
import { clipWallSection, wallSections } from '../geometry/wallSections';

it('clips the wall around an opening and extracts the section above it', () => {
    const wall = new Wall({
        start: { x: 0, y: 0 }, end: { x: 4000, y: 0 },
        openings: [{ offset: 1000, width: 900, height: 2100 }],
    });
    const bounds = section => [
        Math.min(...section.map(point => point.x)),
        Math.max(...section.map(point => point.x)),
    ];

    expect(wallSections(wall, wall.getGeometry()).map(bounds)).toEqual([[0, 1000], [1900, 4000]]);
    expect(bounds(clipWallSection(wall, wall.getGeometry(), 1000, 1900))).toEqual([1000, 1900]);
});
