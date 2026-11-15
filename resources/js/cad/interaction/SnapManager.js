import WallTopology from '../geometry/WallTopology';

export default class SnapManager {
    constructor(tolerance = 150) {
        this.tolerance = tolerance;
    }

    snap(
        point,
        elements,
        tolerance = this.tolerance,
        constraint = null
    ) {
        const walls = elements.filter(e => e.type === 'wall');

        const allowed = p =>
            !constraint ||
            Math.abs(
                p[constraint.axis] - constraint.value
            ) <= 1e-6;

        const nearest = points => {
            let best = null;
            let bestDistance = tolerance;

            for (const p of points) {
                if (!allowed(p)) continue;

                const distance = Math.hypot(
                    p.x - point.x,
                    p.y - point.y
                );

                if (distance < bestDistance) {
                    best = p;
                    bestDistance = distance;
                }
            }

            return best;
        };

        const endpoint = nearest(
            walls.flatMap(w => [w.start, w.end])
        );

        if (endpoint) return { ...endpoint };

        const candidates = [];

        for (const wall of walls) {
            if (!constraint) {
                candidates.push(
                    WallTopology.project(point, wall).point
                );
                continue;
            }

            const { axis, value } = constraint;
            const delta = wall.end[axis] - wall.start[axis];

            if (Math.abs(delta) < 1e-9) {
                if (
                    Math.abs(wall.start[axis] - value) <= 1e-6
                ) {
                    candidates.push(
                        WallTopology.project(point, wall).point
                    );
                }

                continue;
            }

            const t = (value - wall.start[axis]) / delta;

            if (t >= 0 && t <= 1) {
                candidates.push({
                    x: wall.start.x +
                        t * (wall.end.x - wall.start.x),
                    y: wall.start.y +
                        t * (wall.end.y - wall.start.y)
                });
            }
        }

        return nearest(candidates) ?? point;
    }

    isOnWall(point, elements) {
        return elements.some(element =>
            element.type === 'wall' &&
            WallTopology.project(point, element).distance <= 1e-6
        );
    }
}