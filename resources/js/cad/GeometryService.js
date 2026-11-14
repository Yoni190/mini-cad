export default class GeometryService {

    /**
     * Calculates the four corners of a wall based on its
     * start point, end point, and thickness.
     *
     * The wall extends perpendicular to its direction.
     */
    static getWallCorners (wall) {
        const { start, end, thickness } = wall;
        const length = wall.getLength();

        const dx = end.x - start.x;
        const dy = end.y - start.y;

        // Normalize the perpendicular vector to the wall's direction
        const nx = -dy / length;
        const ny = dx / length;

        const side = wall.thicknessSide ?? 1;

        // Scale the perpendicular vector by the wall thickness
        const ox = nx * thickness * side;
        const oy = ny * thickness * side;

        // Return the four corners of the wall polygon
        return [
            { x: start.x, y: start.y },
            { x: end.x, y: end.y },
            { x: end.x + ox, y: end.y + oy },
            { x: start.x + ox, y: start.y + oy },
        ];

    }   

    /**
     * Calculates an axis-aligned column footprint in millimeters.
     * The stored position is one corner, rather than the center.
     */
    static getColumnCorners(column) {
        const { position, width, depth } = column;

        return [
            { x: position.x, y: position.y },
            { x: position.x + width, y: position.y },
            { x: position.x + width, y: position.y + depth },
            { x: position.x, y: position.y + depth }
        ];
    }

    /**
     * Places an endpoint at an exact distance from the start.
     *
     * The direction point supplies only the direction; normalizing
     * its vector allows the requested length to control the distance.
     */
    static getEndPoint(start, directionPoint, length) {
        //Calculate the direction vector
        const dx = directionPoint.x - start.x;
        const dy = directionPoint.y - start.y;

        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
            throw new Error('Direction point must differ from start');
        }

        if (!Number.isFinite(length) || length <= 0) {
            throw new Error('Length must be a positive number');
        }

        //Calculate unit vector
        const ux = dx / distance;
        const uy = dy / distance;

        //Return new endpoint
        return {
            x: start.x + (ux * length),
            y: start.y + (uy * length)
        };
    }

    /**
     * Checks whether any pair of wall endpoints is within the
     * given tolerance in millimeters. This does not join their shapes.
     */
    static areWallsConnected(wallA, wallB, tolerance = 1) {
        // Collect both endpoints of each wall
        const pointsA = [wallA.start, wallA.end];
        const pointsB = [wallB.start, wallB.end];

        // Compare every endpoint of A
        // with every endpoint of B
        for (const pointA of pointsA) {
            for (const pointB of pointsB) {

                // Calculate distance between the points in mm
                const distance = Math.hypot(
                    pointA.x - pointB.x,
                    pointA.y - pointB.y
                );

                // If the endpoints are close enough,
                // the walls are considered connected
                if (distance <= tolerance) {
                    return true;
                }
            }
        }

        // No endpoint pairs are close enough
        return false;
    }

    /**
     * Finds the intersection of two infinite lines, not bounded segments.
     *
     * Outer wall edges may need extending to meet at a corner.
     * Returns null when the lines have no stable unique intersection.
     */
    static lineIntersection(p1, p2, p3, p4) {
        // Direction vector of the first line
        const dx1 = p2.x - p1.x;
        const dy1 = p2.y - p1.y;

        // Direction vector of the second line
        const dx2 = p4.x - p3.x;
        const dy2 = p4.y - p3.y;

        // Cross product of both direction vectors
        const denominator = dx1 * dy2 - dy1 * dx2;

        // Parallel or nearly parallel lines have no
        // stable, unique intersection
        const length1 = Math.hypot(dx1, dy1);
        const length2 = Math.hypot(dx2, dy2);

        if (
            length1 === 0 ||
            length2 === 0 ||
            Math.abs(denominator) < 1e-8 * length1 * length2
        ) {
            return null;
        }

        // Vector from the start of line 1 to line 2
        const dx3 = p3.x - p1.x;
        const dy3 = p3.y - p1.y;

        // How far to travel along the first line
        const t = (dx3 * dy2 - dy3 * dx2) / denominator;

        return {
            x: p1.x + t * dx1,
            y: p1.y + t * dy1
        };
    }


    /**
     * Builds a corner join where wall A ends exactly where wall B starts.
     *
     * Only the outer footprint corners change. The stored reference
     * endpoints and measured lengths remain unchanged.
     * Returns null for unsupported or invalid joins.
     */
    static getJoinedWallCorners(wallA, wallB) {
        if (
            wallA.end.x !== wallB.start.x ||
            wallA.end.y !== wallB.start.y
        ) {
            return null;
        }

        const a = wallA.getGeometry().map(p => ({ ...p }));
        const b = wallB.getGeometry().map(p => ({ ...p }));

        const sameSide =
            (wallA.thicknessSide ?? 1) ===
            (wallB.thicknessSide ?? 1);

        // Match the physical faces, accounting for thickness direction.
        const referenceJoin = this.lineIntersection(
            a[0], a[1],
            ...(sameSide ? [b[0], b[1]] : [b[3], b[2]])
        );

        const offsetJoin = this.lineIntersection(
            a[3], a[2],
            ...(sameSide ? [b[3], b[2]] : [b[0], b[1]])
        );

        if (!referenceJoin || !offsetJoin) {
            return null;
        }

        const maxMiter =
            Math.max(wallA.thickness, wallB.thickness) * 4;

        if (
            [referenceJoin, offsetJoin].some(point =>
                Math.hypot(
                    point.x - wallA.end.x,
                    point.y - wallA.end.y
                ) > maxMiter
            )
        ) {
            return null;
        }

        // Adjust display corners only; stored endpoints stay unchanged.
        a[1] = { ...referenceJoin };
        a[2] = { ...offsetJoin };

        b[0] = { ...(sameSide ? referenceJoin : offsetJoin) };
        b[3] = { ...(sameSide ? offsetJoin : referenceJoin) };

        if (
            !this.isSimplePolygon(a) ||
            !this.isSimplePolygon(b)
        ) {
            return null;
        }

        return {
            wallACorners: a,
            wallBCorners: b
        };
    }

    /**
     * Checks that a footprint has finite coordinates, nonzero edges
     * and area, and no intersections between non-adjacent edges.
     *
     * This prevents invalid joined shapes from reaching the renderers.
     */
    static isSimplePolygon(corners) {
        if (!Array.isArray(corners) || corners.length < 3) {
            return false;
        }

        if (!corners.every(point =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y)
        )) {
            return false;
        }

        const cross = (a, b, c) =>
            (b.x - a.x) * (c.y - a.y) -
            (b.y - a.y) * (c.x - a.x);

        const onSegment = (a, b, p) =>
            p.x >= Math.min(a.x, b.x) &&
            p.x <= Math.max(a.x, b.x) &&
            p.y >= Math.min(a.y, b.y) &&
            p.y <= Math.max(a.y, b.y);

        const segmentsIntersect = (a, b, c, d) => {
            const o1 = cross(a, b, c);
            const o2 = cross(a, b, d);
            const o3 = cross(c, d, a);
            const o4 = cross(c, d, b);

            if ((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) &&
                (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) {
                return true;
            }

            return (o1 === 0 && onSegment(a, b, c)) ||
                (o2 === 0 && onSegment(a, b, d)) ||
                (o3 === 0 && onSegment(c, d, a)) ||
                (o4 === 0 && onSegment(c, d, b));
        };

        const n = corners.length;

        // Check for zero-length edges.
        for (let i = 0; i < n; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % n];

            if (a.x === b.x && a.y === b.y) {
                return false;
            }
        }

        // Check non-adjacent edges for intersections.
        for (let i = 0; i < n; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % n];

            for (let j = i + 1; j < n; j++) {
                // Adjacent edges share a vertex by design.
                if (j === i + 1 || (i === 0 && j === n - 1)) {
                    continue;
                }

                const c = corners[j];
                const d = corners[(j + 1) % n];

                if (segmentsIntersect(a, b, c, d)) {
                    return false;
                }
            }
        }

        // Reject zero-area polygons.
        let twiceArea = 0;

        for (let i = 0; i < n; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % n];
            twiceArea += a.x * b.y - b.x * a.y;
        }

        return Number.isFinite(twiceArea) && twiceArea !== 0;
    }

    static resolveWallThicknessSide(start, end, walls, fallback = 1) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy);

        if (length === 0) return fallback;

        const ux = dx / length;
        const uy = dy / length;

        const samePoint = (a, b) =>
            Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

        const alignedSides = new Set();
        const continuations = [];

        for (const wall of walls) {
            if (wall.type !== 'wall') continue;

            const startStart = samePoint(start, wall.start);
            const startEnd = samePoint(start, wall.end);
            const endStart = samePoint(end, wall.start);
            const endEnd = samePoint(end, wall.end);

            if (!startStart && !startEnd && !endStart && !endEnd) {
                continue;
            }

            const wx = wall.end.x - wall.start.x;
            const wy = wall.end.y - wall.start.y;
            const wallLength = Math.hypot(wx, wy);

            if (wallLength === 0) continue;

            const vx = wx / wallLength;
            const vy = wy / wallLength;
            const existingSide = wall.thicknessSide ?? 1;

            // Parallel walls sharing an endpoint:
            // preserve the same physical side, even if drawn in reverse.
            if (Math.abs(ux * vy - uy * vx) < 1e-8) {
                const sameDirection = ux * vx + uy * vy > 0;

                alignedSides.add(
                    existingSide * (sameDirection ? 1 : -1)
                );
                continue;
            }

            // At a simple corner, preserve the boundary's orientation.
            const continuesDirection = startEnd || endStart;

            continuations.push(
                existingSide * (continuesDirection ? 1 : -1)
            );
        }

        // Aligned existing walls take priority over corner neighbors.
        if (alignedSides.size === 1) {
            return [...alignedSides][0];
        }

        // Conflicting aligned walls need an explicit user choice.
        if (alignedSides.size > 1) return fallback;

        // A single neighbor provides an unambiguous continuation.
        if (continuations.length === 1) {
            return continuations[0];
        }

        return fallback;
    }
}