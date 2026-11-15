import GeometryService from './GeometryService';

// Resolve display footprints without changing the stored wall reference edges.
export default class WallGeometry {
    
    /**
     * Derives wall footprints with supported two-wall corner joins.
     *
     * Junctions use shared endpoints. Supported branches are trimmed to
     * their host wall; unsafe joins retain their original footprints.
     * The returned map changes display geometry, not stored wall data.
     */
    static calculate(elements) {
        const walls = elements.filter(e => e.type === 'wall');

        const base = new Map(
            walls.map(wall => [wall.id, wall.getGeometry()])
        );

        const junctions = new Map();

        for (const wall of walls) {
            for (const atStart of [true, false]) {
                const point = atStart ? wall.start : wall.end;
                const other = atStart ? wall.end : wall.start;

                const angle = Math.atan2(
                    other.y - point.y,
                    other.x - point.x
                );

                // Orient each wall away from the junction.
                const side =
                    (wall.thicknessSide ?? 1) *
                    (atStart ? 1 : -1);

                const reference = atStart ? 0 : 1;
                const offset = atStart ? 3 : 2;
                const key = `${point.x},${point.y}`;

                if (!junctions.has(key)) {
                    junctions.set(key, []);
                }

                junctions.get(key).push({
                    wall,
                    point,
                    angle,
                    left: side > 0 ? offset : reference,
                    right: side > 0 ? reference : offset
                });
            }
        }

        const edgeLine = (ray, index) => {
            const corners = base.get(ray.wall.id);

            return index < 2
                ? [corners[0], corners[1]]
                : [corners[3], corners[2]];
        };

        const candidates = [];
        const branchEndpoints = [];

        for (const rays of junctions.values()) {
            if (rays.length < 2) continue;

            if (rays.length >= 3) {
                const branchChanges = this.getBranchJoinChanges(rays, base);

                if (branchChanges !== null) {
                    if (branchChanges.length > 0) {
                        candidates.push(branchChanges);
                    }

                    continue;
                }

                branchEndpoints.push(...rays);
            }

            rays.sort((a, b) => a.angle - b.angle);

            const changes = [];
            let supported = true;

            for (let i = 0; i < rays.length; i++) {
                const a = rays[i];
                const b = rays[(i + 1) % rays.length];

                const gap = (
                    b.angle - a.angle + Math.PI * 2
                ) % (Math.PI * 2);

                // Overlapping rays cannot form a normal junction.
                if (gap < 1e-8) {
                    supported = false;
                    break;
                }

                const hit = GeometryService.lineIntersection(
                    ...edgeLine(a, a.left),
                    ...edgeLine(b, b.right)
                );

                // Parallel faces keep their original endpoints.
                if (!hit) continue;

                const limit = Math.max(
                    a.wall.thickness,
                    b.wall.thickness
                ) * 4;

                if (
                    Math.hypot(
                        hit.x - a.point.x,
                        hit.y - a.point.y
                    ) > limit
                ) {
                    supported = false;
                    break;
                }

                changes.push(
                    {
                        id: a.wall.id,
                        index: a.left,
                        point: hit
                    },
                    {
                        id: b.wall.id,
                        index: b.right,
                        point: hit
                    }
                );
            }

            if (supported && changes.length) {
                candidates.push(changes);
            }
        }

        const active = new Set(candidates);

        while (true) {
            const result = new Map(
                [...base].map(([id, corners]) => [
                    id,
                    corners.map(point => ({ ...point }))
                ])
            );

            for (const changes of active) {
                for (const change of changes) {
                    result.get(change.id)[change.index] = {
                        ...change.point
                    };
                }
            }

            // Keep each branch connected to the shared reference point.
            // A trimmed reference corner can otherwise leave a triangular
            // hole between three or more individually valid footprints.
            for (const ray of branchEndpoints) {
                const corners = result.get(ray.wall.id);
                const atStart = ray.point.x === ray.wall.start.x &&
                    ray.point.y === ray.wall.start.y;
                const index = atStart ? 0 : 1;
                const corner = corners[index];
                const distance = (corner.x - ray.point.x) * Math.cos(ray.angle) +
                    (corner.y - ray.point.y) * Math.sin(ray.angle);

                if (distance > 1e-6) {
                    corners[index] = { ...ray.point };
                }
            }

            const invalid = new Set(
                [...result]
                    .filter(([, corners]) =>
                        !GeometryService.isSimplePolygon(corners)
                    )
                    .map(([id]) => id)
            );

            if (!invalid.size) return result;

            // Reject junction changes that invalidate a wall.
            let removed = false;

            for (const changes of active) {
                if (changes.some(change => invalid.has(change.id))) {
                    active.delete(changes);
                    removed = true;
                }
            }

            if (!removed) return base;
        }
    }

    static getBranchJoinChanges(rays, base) {
        const epsilon = 1e-6;

        const direction = ray => ({
            x: Math.cos(ray.angle),
            y: Math.sin(ray.angle)
        });

        // The offset from a wall's reference edge to its other face.
        const offset = ray => {
            const corners = base.get(ray.wall.id);

            return {
                x: corners[3].x - corners[0].x,
                y: corners[3].y - corners[0].y
            };
        };

        const pairs = [];

        for (let i = 0; i < rays.length; i++) {
            for (let j = i + 1; j < rays.length; j++) {
                const a = rays[i];
                const b = rays[j];

                const da = direction(a);
                const db = direction(b);

                const dot = da.x * db.x + da.y * db.y;
                const oa = offset(a);
                const ob = offset(b);

                const sameOffset =
                    Math.hypot(oa.x - ob.x, oa.y - ob.y) <= epsilon;

                // Two opposite rays with matching offsets form one
                // continuous wall through the junction.
                if (dot < -1 + 1e-8 && sameOffset) {
                    const axisAngle =
                        ((a.angle % Math.PI) + Math.PI) % Math.PI;

                    pairs.push({
                        a,
                        b,
                        axisAngle,
                        thickness: a.wall.thickness
                    });
                }
            }
        }

        // No straight host wall: use the existing junction algorithm.
        if (pairs.length === 0) return null;

        // At an X-junction, use the thicker wall as the host.
        // The angle provides a consistent choice for equal thicknesses.
        pairs.sort((a, b) =>
            b.thickness - a.thickness ||
            a.axisAngle - b.axisAngle
        );

        const host = pairs[0];
        const hostCorners = base.get(host.a.wall.id);
        const hostOffset = offset(host.a);

        const changes = [];

        for (const branch of rays) {
            if (branch === host.a || branch === host.b) continue;

            const branchDirection = direction(branch);

            const pointsTowardOffset =
                branchDirection.x * hostOffset.x +
                branchDirection.y * hostOffset.y > 0;

            // Choose the host face nearest the body of the branch.
            const hostFace = pointsTowardOffset
                ? [hostCorners[3], hostCorners[2]]
                : [hostCorners[0], hostCorners[1]];

            const corners = base.get(branch.wall.id);

            const referenceHit = GeometryService.lineIntersection(
                corners[0], corners[1],
                ...hostFace
            );

            const offsetHit = GeometryService.lineIntersection(
                corners[3], corners[2],
                ...hostFace
            );

            if (!referenceHit || !offsetHit) {
                // Keep the original footprints if this junction
                // cannot be resolved safely.
                return [];
            }

            const limit = Math.max(
                host.thickness,
                branch.wall.thickness
            ) * 4;

            if (
                [referenceHit, offsetHit].some(point =>
                    Math.hypot(
                        point.x - branch.point.x,
                        point.y - branch.point.y
                    ) > limit
                )
            ) {
                return [];
            }

            const atStart =
                branch.point.x === branch.wall.start.x &&
                branch.point.y === branch.wall.start.y;

            changes.push(
                {
                    id: branch.wall.id,
                    index: atStart ? 0 : 1,
                    point: referenceHit
                },
                {
                    id: branch.wall.id,
                    index: atStart ? 3 : 2,
                    point: offsetHit
                }
            );
        }

        return changes;
    }

}
