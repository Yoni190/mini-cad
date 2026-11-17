export function clipWallSection(wall, corners, start, end) {
    const length = wall.getLength();
    const dx = (wall.end.x - wall.start.x) / length;
    const dy = (wall.end.y - wall.start.y) / length;

    // Distance along the wall's reference line.
    const position = point =>
        (point.x - wall.start.x) * dx +
        (point.y - wall.start.y) * dy;

    // Keep the portion of a polygon on one side of a cut.
    function clip(polygon, boundary, keepAfter) {
        const result = [];

        for (let i = 0; i < polygon.length; i++) {
            const current = polygon[i];
            const previous = polygon[(i + polygon.length - 1) % polygon.length];

            const currentDistance = position(current) - boundary;
            const previousDistance = position(previous) - boundary;

            const currentInside = keepAfter
                ? currentDistance >= 0
                : currentDistance <= 0;

            const previousInside = keepAfter
                ? previousDistance >= 0
                : previousDistance <= 0;

            if (currentInside !== previousInside) {
                const fraction = previousDistance /
                    (previousDistance - currentDistance);

                result.push({
                    x: previous.x + fraction * (current.x - previous.x),
                    y: previous.y + fraction * (current.y - previous.y),
                });
            }

            if (currentInside) {
                result.push(current);
            }
        }

        return result;
    }

    let section = corners;
    if (start !== null) section = clip(section, start, true);
    if (end !== null) section = clip(section, end, false);
    return section;
}

export function wallSections(wall, corners) {
    const sections = [];
    let start = null;

    for (const opening of wall.openings) {
        const section = clipWallSection(wall, corners, start, opening.offset);
        if (section.length >= 3) sections.push(section);
        start = opening.offset + opening.width;
    }

    const lastSection = clipWallSection(wall, corners, start, null);
    if (lastSection.length >= 3) sections.push(lastSection);
    return sections;
}
