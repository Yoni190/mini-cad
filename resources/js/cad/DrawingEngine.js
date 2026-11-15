import Wall from "./models/Wall";
import Column from "./models/Column";
import GeometryService from "./geometry/GeometryService";
import WallTopology from './geometry/WallTopology';
import WallGeometry from './geometry/WallGeometry';

export default class DrawingEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.elements = [];
        this.onRender = null;
        this.onModelChange = null;
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;
    }

    replaceElements(elements) {
        this.elements = elements;
        this.invalidateWallGeometry();
        this.render();
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

    /** Moves a column; the caller schedules the redraw during dragging. */
    moveColumn(id, position) {
        const column = this.elements.find(element => element.id === id && element.type === 'column');
        if (!column) throw new Error('Column not found');

        const candidate = new Column({ ...column, position });
        if (column.position.x === candidate.position.x && column.position.y === candidate.position.y) {
            return false;
        }

        column.position = candidate.position;
        this.notifyModelChange();
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

        this.invalidateWallGeometry();
        return true;
    }

    getRooms() {
        return WallTopology.rooms(this.elements);
    }

    /**
     * Redraws stored elements using their resolved display geometry.
     *
     * Temporary previews are drawn separately by EditorController.
     */
    render(selectedId = null) {
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

        this.render(column.id);
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
        this.render(wall.id);
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
            this.wallGeometryCache = WallGeometry.calculate(this.elements);
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
