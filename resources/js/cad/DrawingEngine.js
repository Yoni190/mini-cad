import Wall from "./models/Wall";
import Column from "./models/Column";
import GeometryService from "./geometry/GeometryService";
import WallTopology from './geometry/WallTopology';
import WallGeometry from './geometry/WallGeometry';

const MAX_ELEMENTS = 1000;

export default class DrawingEngine {
    constructor() {
        this.elements = [];
        this.onModelChange = null;
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;
    }

    replaceElements(elements) {
        this.elements = elements;
        this.handleModelChange({ wallsChanged: true });
    }

    addWall(start, end, thickness = 200, thicknessSide = null) {
        const side = thicknessSide
        ?? GeometryService.resolveWallThicknessSide(
            start,
            end,
            this.elements
        );

        const wall = new Wall({
            start,
            end,
            thickness,
            thicknessSide: side
        });

        // Build the result before changing the current model.
        const nextElements = WallTopology.split([
            ...this.elements,
            wall
        ]);

        if (nextElements.length > MAX_ELEMENTS) {
            throw new Error('A project can contain at most 1,000 elements. Remove elements before adding this wall.');
        }

        const rooms = WallTopology.rooms(nextElements);
        const walls = nextElements.filter(element => element.type === 'wall');
        const edgeKey = (a, b) => `${a.x},${a.y}|${b.x},${b.y}`;
        const edges = new Map(walls.map(element => [edgeKey(element.start, element.end), element]));
        const sides = new Map();
        const affected = new Set();

        for (const room of rooms) {
            const boundary = room.polygon.map((point, i) => {
                const next = room.polygon[(i + 1) % room.polygon.length];
                const forward = edges.get(edgeKey(point, next));
                return { wall: forward ?? edges.get(edgeKey(next, point)), side: forward ? -1 : 1 };
            });
            const touchesNewWall = boundary.some(({ wall: part }) =>
                WallTopology.project(part.start, wall).distance < 1e-6 &&
                WallTopology.project(part.end, wall).distance < 1e-6
            );
            for (const { wall: part, side } of boundary) {
                if (!sides.has(part.id)) sides.set(part.id, new Set());
                sides.get(part.id).add(side);
                if (touchesNewWall) affected.add(part.id);
            }
        }

        for (const part of walls) {
            const choices = sides.get(part.id);
            if (affected.has(part.id) && choices?.size === 1) {
                part.thicknessSide = [...choices][0];
            }
        }

        this.elements = nextElements;
        this.handleModelChange({ wallsChanged: true });
    }

    addColumn(position) {
        if (this.elements.length >= MAX_ELEMENTS) {
            throw new Error('A project can contain at most 1,000 elements. Remove elements before adding a column.');
        }

        const column = new Column({ position });

        this.elements.push(column);
        this.handleModelChange();
    }

    /** Moves a column; the caller schedules the redraw during dragging. */
    moveColumn(id, position) {
        const column = this.elements.find(element => element.id === id && element.type === 'column');
        if (!column) throw new Error('Column not found');

        const candidate = new Column({ ...column, position });
        if (column.position.x === candidate.position.x && column.position.y === candidate.position.y) {
            return false;
        }

        column.position = candidate.position;
        this.handleModelChange();
        return true;
    }

    /**
     * Validates a group of endpoint changes before committing any of them.
     * Keeps element instances stable for selection and active drag gestures.
     * Returns false for a collapsed wall or an unchanged batch. The caller
     * schedules the redraw, so mouse events can share one animation frame.
     */
    updateWallEndpoints(changes) {
        const pending = new Map();

        for (const { id, start, end } of changes) {
            const wall = this.elements.find(element => element.id === id && element.type === 'wall');
            if (!wall) throw new Error('Wall not found');
            if (pending.has(id)) throw new Error('Duplicate wall update');

            if (!start || !end ||
                !Number.isFinite(start.x) || !Number.isFinite(start.y) ||
                !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
                throw new Error('Invalid wall start or end point');
            }

            // Preserve the minimum length used when dragging connected walls.
            if (Math.hypot(end.x - start.x, end.y - start.y) < 0.001) {
                return false;
            }

            pending.set(id, { wall, start: { ...start }, end: { ...end } });
        }

        const changed = [...pending.values()].filter(({ wall, start, end }) =>
            wall.start.x !== start.x || wall.start.y !== start.y ||
            wall.end.x !== end.x || wall.end.y !== end.y
        );
        if (!changed.length) return false;

        for (const { wall, start, end } of changed) {
            wall.start = start;
            wall.end = end;
        }

        this.handleModelChange({ wallsChanged: true });
        return true;
    }

    updateColumnDimensions(id, width, depth) {
        const column = this.elements.find(
            element => element.id === id
        );

        if (!column || column.type !== 'column') {
            throw new Error('Column not found');
        }

        width = Number(width);
        depth = Number(depth);

        if(!Number.isFinite(width) || width <= 0) {
            throw new Error('Column width must be a positive number');
        }
        if(!Number.isFinite(depth) || depth <= 0) {
            throw new Error('Column depth must be a positive number');
        }

        if (column.width === width && column.depth === depth) {
            return;
        }

        column.width = width;
        column.depth = depth;

        this.handleModelChange();
    }

    updateWallThickness(id, thickness) {
        const wall = this.elements.find(
            element => element.id === id && element.type === 'wall'
        );

        if (!wall) {
            throw new Error('Wall not found.');
        }

        thickness = Number(thickness);

        if (!Number.isFinite(thickness) || thickness <= 0) {
            throw new Error('Wall thickness must be a positive number.');
        }

        if (wall.thickness === thickness) {
            return;
        }

        wall.thickness = thickness;
        this.handleModelChange({ wallsChanged: true });
    }

    updateWallHeight(id, height) {
        const wall = this.elements.find(element => element.id === id && element.type === 'wall');
        if (!wall) throw new Error('Wall not found.');
        height = Number(height);
        if (!Number.isFinite(height) || height <= 0) {
            throw new Error('Wall height must be a positive number.');
        }
        if (wall.height === height) return;
        wall.height = height;
        this.handleModelChange();
    }

    /** Clears derived wall geometry without notifying listeners or redrawing. */
    invalidateWallGeometry() {
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;
    }

    /**
     * Runs after a model change has been committed. Invalidate before notifying:
     * listeners such as the 3D view may request geometry immediately.
     * Redrawing remains with the caller so drag updates can be scheduled.
     */
    handleModelChange({ wallsChanged = false } = {}) {
        if (wallsChanged) this.invalidateWallGeometry();
        this.notifyModelChange();
    }

    getWallDisplayGeometry() {
        if (
            this.wallGeometryCache === null ||
            this.wallGeometryElements !== this.elements
        ) {
            this.wallGeometryCache = WallGeometry.calculate(this.elements);
            this.wallGeometryElements = this.elements;
        }

        return this.wallGeometryCache;
    }

    notifyModelChange() {
        this.onModelChange?.();
    }

    moveElements(elements, dx, dy) {
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return;
        for (const element of elements) {
            if (element.type === 'wall') {
                element.start = { x: element.start.x + dx, y: element.start.y + dy };
                element.end = { x: element.end.x + dx, y: element.end.y + dy };
            } else {
                element.position = { x: element.position.x + dx, y: element.position.y + dy };
            }
        }
        this.handleModelChange({ wallsChanged: elements.some(element => element.type === 'wall') });
    }

    removeElements(ids) {
        const selected = new Set(ids);
        const removed = this.elements.filter(element => selected.has(element.id));
        if (!removed.length) return;
        const remaining = this.elements.filter(element => !selected.has(element.id));
        this.elements.splice(0, this.elements.length, ...remaining);
        this.handleModelChange({ wallsChanged: removed.some(element => element.type === 'wall') });
    }

}
