import GeometryService from './GeometryService';
import Wall from '../models/Wall';

const EPS = 1e-6;

const distance = (a, b) =>
    Math.hypot(a.x - b.x, a.y - b.y);

export default class WallTopology {
    static project(point, wall) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;

        const t = Math.max(0, Math.min(1,
            ((point.x - wall.start.x) * dx +
             (point.y - wall.start.y) * dy) /
            (dx * dx + dy * dy)
        ));

        const projected = {
            x: wall.start.x + t * dx,
            y: wall.start.y + t * dy
        };

        return {
            point: projected,
            t,
            distance: distance(point, projected)
        };
    }

    static split(elements, extraPoints = []) {
        const walls = elements.filter(e => e.type === 'wall');
        const pool = [];

        // Shared junctions must use exactly matching coordinates.
        const canonical = point => {
            let found = pool.find(p => distance(p, point) <= EPS);

            if (!found) {
                found = { ...point };
                pool.push(found);
            }

            return found;
        };

        const cuts = walls.map(wall => [
            canonical(wall.start),
            canonical(wall.end)
        ]);

        const add = (index, point) => {
            const p = canonical(point);

            if (!cuts[index].includes(p)) {
                cuts[index].push(p);
            }
        };

        for (let i = 0; i < walls.length; i++) {
            for (const point of extraPoints) {
                const projected = this.project(point, walls[i]);

                if (projected.distance <= EPS) {
                    add(i, projected.point);
                }
            }

            for (let j = i + 1; j < walls.length; j++) {
                const a = walls[i];
                const b = walls[j];

                const hit = GeometryService.lineIntersection(
                    a.start, a.end,
                    b.start, b.end
                );

                if (hit) {
                    if (
                        this.project(hit, a).distance <= EPS &&
                        this.project(hit, b).distance <= EPS
                    ) {
                        add(i, hit);
                        add(j, hit);
                    }

                    continue;
                }

                // Parallel walls may touch, but cannot overlap.
                const shared = [];

                for (const p of [
                    a.start, a.end,
                    b.start, b.end
                ]) {
                    if (
                        this.project(p, a).distance <= EPS &&
                        this.project(p, b).distance <= EPS &&
                        !shared.some(q => distance(p, q) <= EPS)
                    ) {
                        shared.push(p);
                    }
                }

                if (shared.length > 1) {
                    throw new Error(
                        'Overlapping walls are not supported.'
                    );
                }

                for (const p of shared) {
                    add(i, p);
                    add(j, p);
                }
            }
        }

        const result = elements.filter(e => e.type !== 'wall');

        walls.forEach((wall, index) => {
            cuts[index].sort((a, b) =>
                this.project(a, wall).t -
                this.project(b, wall).t
            );

            for (let k = 0; k < cuts[index].length - 1; k++) {
                const start = cuts[index][k];
                const end = cuts[index][k + 1];

                if (distance(start, end) <= EPS) continue;

                result.push(new Wall({
                    ...wall,
                    start,
                    end,
                    // Keep the original ID on the first piece.
                    id: k === 0 ? wall.id : undefined
                }));
            }
        });

        return result;
    }

    /**
     * Tests whether an existing route connects the proposed wall endpoints.
     * Requires at least two segments after temporary splitting. The query
     * preserves source elements and uses the drafting tolerance of < 1e-6 mm.
     * Splitting errors propagate to the caller before a new wall is committed.
     */
    static hasPath(elements, start, end) {
        const samePoint = (a, b) => distance(a, b) < EPS;
        // Temporarily split at the proposed connection points so the
        // path search recognizes points inside existing walls.
        const walls = this.split(
            elements,
            [start, end]
        ).filter(element => element.type === 'wall');

        const queue = [{ point: start, depth: 0 }];
        const visited = [start];

        for (let i = 0; i < queue.length; i++) {
            const { point, depth } = queue[i];
            for (const wall of walls) {
                const next = samePoint(point, wall.start) ? wall.end
                    : samePoint(point, wall.end) ? wall.start : null;
                if (!next) continue;
                if (samePoint(next, end) && depth + 1 >= 2) return true;
                if (!visited.some(visitedPoint => samePoint(visitedPoint, next))) {
                    visited.push(next);
                    queue.push({ point: next, depth: depth + 1 });
                }
            }
        }
        return false;
    }

    static rooms(elements) {
        const nodes = new Map();
        const edges = [];

        const node = point => {
            const key = `${point.x},${point.y}`;

            if (!nodes.has(key)) {
                nodes.set(key, {
                    point,
                    outgoing: []
                });
            }

            return nodes.get(key);
        };

        for (const wall of this.split(elements)) {
            if (wall.type !== 'wall') continue;

            const a = node(wall.start);
            const b = node(wall.end);

            const forward = {
                from: a,
                to: b
            };

            const reverse = {
                from: b,
                to: a
            };

            forward.twin = reverse;
            reverse.twin = forward;

            a.outgoing.push(forward);
            b.outgoing.push(reverse);

            edges.push(forward, reverse);
        }

        for (const n of nodes.values()) {
            n.outgoing.sort((a, b) =>
                Math.atan2(
                    a.to.point.y - n.point.y,
                    a.to.point.x - n.point.x
                ) -
                Math.atan2(
                    b.to.point.y - n.point.y,
                    b.to.point.x - n.point.x
                )
            );
        }

        const visited = new Set();
        const rooms = [];

        for (const first of edges) {
            if (visited.has(first)) continue;

            const boundary = [];
            let edge = first;

            do {
                visited.add(edge);
                boundary.push(edge);

                const outgoing = edge.to.outgoing;
                const index = outgoing.indexOf(edge.twin);

                edge = outgoing[
                    (index - 1 + outgoing.length) %
                    outgoing.length
                ];
            } while (edge !== first);

            const polygon = boundary.map(edge => ({
                ...edge.from.point
            }));

            const twiceArea = polygon.reduce((sum, p, i) => {
                const q = polygon[(i + 1) % polygon.length];
                return sum + p.x * q.y - q.x * p.y;
            }, 0);

            // This traversal gives bounded faces positive area.
            if (twiceArea > EPS) {
                rooms.push({
                    polygon
                });
            }
        }

        return rooms;
    }
}
