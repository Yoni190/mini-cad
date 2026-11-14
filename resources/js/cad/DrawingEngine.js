import Wall from "./models/Wall";
import Column from "./models/Column";
import GeometryService from "./GeometryService";
import WallTopology from './WallTopology';

export default class DrawingEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.elements = [];
        this.startPoint = null;
        this.onRender = null;
        this.onModelChange = null;
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;
    }

    addWall(start, end, thickness = 200, thicknessSide = null) {
        const side = thicknessSide
        ?? GeometryService.resolveWallThicknessSide(
            start,
            end,
            this.elements
        );

        //Create a wall instance
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

        //Add the wall to this.elements
        this.elements = nextElements;
        this.invalidateWallGeometry();

        //Render all elements
        this.render();
    }

    addColumn(position) {
        //Create a column instance
        const column = new Column({ position });

        //Add the column to this.elements
        this.elements.push(column);
        this.notifyModelChange();

        //Render all elements
        this.render();
    }

    getRooms() {
        return WallTopology.rooms(this.elements);
    }

    /**
     * Redraws stored elements using their resolved display geometry.
     *
     * The preview is drawn separately without entering the element
     * collection, so mouse movement never commits temporary walls.
     */
    render(previewWall = null, selectedId = null) {
        const wallGeometry = this.getWallDisplayGeometry();

        //Clear canvas
        this.renderer.clear();

        // Draw the grid
        this.renderer.drawGrid();

        //Draw walls and columns
        for (const element of this.elements) {
            const isSelected = element.id === selectedId;

            const corners = element.type === 'wall'
                ? wallGeometry.get(element.id) ?? element.getGeometry()
                : element.getGeometry();

            if (!this.renderer.isGeometryVisible(corners)) {
                continue;
            }

            this.renderer.drawElement(
                element,
                false,
                isSelected,
                corners
            );
        }

        if (previewWall) {
            this.renderer.drawElement(previewWall, true);

            if(previewWall.type === 'wall'){
                this.renderer.drawWallLength(previewWall);
            }
        }

        // Notify components after rendering
        this.onRender?.();
    }

    updateColumnDimensions(id, width, depth) {
        //Find element by id
        const column = this.elements.find(
            element => element.id === id
        );

        //Confirm that the element is a column
        if (!column || column.type !== 'column') {
            throw new Error('Column not found');
        }

        width = Number(width);
        depth = Number(depth);

        //Validate width and depth
        if(!Number.isFinite(width) || width <= 0) {
            throw new Error('Column width must be a positive number');
        }
        if(!Number.isFinite(depth) || depth <= 0) {
            throw new Error('Column depth must be a positive number');
        }

        // Skip redraws if dimensions didn't change
        if (column.width === width && column.depth === depth) {
            return;
        }

        //Update dimensions
        column.width = width;
        column.depth = depth;

        this.notifyModelChange();

        this.render(null, column.id);
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

        // Skip redrawing if thickness didn't change
        if (wall.thickness === thickness) {
            return;
        }

        wall.thickness = thickness;
        this.invalidateWallGeometry();

        // Recalculate footprints and joins, preserving the selection.
        this.render(null, wall.id);
    }

    
    /**
     * Derives wall footprints with supported two-wall corner joins.
     *
     * Junctions require exact shared endpoints. Branching junctions
     * and unsupported endpoint directions keep their original footprints.
     * The returned map changes display geometry, not stored wall data.
     */
    calculateWallDisplayGeometry() {
        const walls = this.elements.filter(e => e.type === 'wall');

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

        for (const rays of junctions.values()) {
            if (rays.length < 2) continue;

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

    invalidateWallGeometry() {
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;

        this.notifyModelChange();
    }

    getWallDisplayGeometry() {
        if (
            this.wallGeometryCache === null ||
            this.wallGeometryElements !== this.elements
        ) {
            this.wallGeometryCache = this.calculateWallDisplayGeometry();
            this.wallGeometryElements = this.elements;
        }

        return this.wallGeometryCache;
    }

    notifyModelChange() {
        this.onModelChange?.();
    }

    removeElement(id) {
        const index = this.elements.findIndex(
            element => element.id === id
        );

        if (index === -1) {
            return;
        }

        const [removed] = this.elements.splice(index, 1);

        if (removed.type === 'wall') {
            this.invalidateWallGeometry();
        } else {
            this.notifyModelChange();
        }

        this.render();
    }
}
