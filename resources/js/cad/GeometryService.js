export default class GeometryService {

    static getWallCorners (wall) {
        const { start, end, thickness } = wall;

        //Get wall length
        const length = wall.getLength();

        //Calculate dx and dy
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        //Calculate perpendicular vector
        const nx = -dy / length;
        const ny = dx / length;

        const ox = nx * thickness;
        const oy = ny * thickness;

        return [
            { x: start.x, y: start.y },
            { x: end.x, y: end.y },
            { x: end.x + ox, y: end.y + oy },
            { x: start.x + ox, y: start.y + oy },
        ];

    }   

    static getColumnCorners(column) {
        const { position, width, depth } = column;

        return [
            { x: position.x, y: position.y },
            { x: position.x + width, y: position.y },
            { x: position.x + width, y: position.y + depth },
            { x: position.x, y: position.y + depth }
        ];
    }

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


    static getJoinedWallCorners(wallA, wallB) {
        // Get independent wall footprints.
        // These are new arrays, so we can modify
        // the returned corners without altering the walls.
        const cornersA = wallA.getGeometry().map(p => ({ ...p }));
        const cornersB = wallB.getGeometry().map(p => ({ ...p }));

        // This first implementation only supports
        // A.end joining B.start.
        if (
            wallA.end.x !== wallB.start.x ||
            wallA.end.y !== wallB.start.y
        ) {
            return null;
        }

        // Find the intersection of the OUTER edges.
        // For A: outerStart -> outerEnd
        // For B: outerStart -> outerEnd
        const intersection = this.lineIntersection(
            cornersA[3],
            cornersA[2],
            cornersB[3],
            cornersB[2]
        );

        if (!intersection) {
            return null;
        }

        // Avoid excessively long corners at sharp angles.
        // A production implementation would handle
        // such cases with a bevel or another join style.
        const maxMiter = Math.max(
            wallA.thickness,
            wallB.thickness
        ) * 4;

        if (
            Math.hypot(
                intersection.x - wallA.end.x,
                intersection.y - wallA.end.y
            ) > maxMiter
        ) {
            return null;
        }

        // Replace only the outer endpoint corners.
        cornersA[2] = { ...intersection };
        cornersB[3] = { ...intersection };


        if (
            !this.isSimplePolygon(cornersA) ||
            !this.isSimplePolygon(cornersB)
        ) {
            return null;
        }

        return {
            wallACorners: cornersA,
            wallBCorners: cornersB
        };
    }

    // Check if polygon intersects itself
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
}