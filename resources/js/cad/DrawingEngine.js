import Wall from "./models/Wall";
import Column from "./models/Column";
import GeometryService from "./GeometryService";

export default class DrawingEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.elements = [];
        this.startPoint = null;
        this.onRender = null;
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;
    }

    addWall(start, end) {
        //Create a wall instance
        const wall = new Wall({
            start,
            end
        });

        //Add the wall to this.elements
        this.elements.push(wall);
        this.invalidateWallGeometry();

        //Render all elements
        this.render();
    }

    addColumn(position) {
        //Create a column instance
        const column = new Column({ position });

        //Add the column to this.elements
        this.elements.push(column);

        //Render all elements
        this.render();
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

            const customCorners = element.type === 'wall'
                ? wallGeometry.get(element.id)
                : null;

            this.renderer.drawElement(
                element,
                false,
                isSelected,
                customCorners
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

        //Update dimensions
        column.width = width;
        column.depth = depth;

        this.render();
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
        const walls = this.elements.filter(
            element => element.type === 'wall'
        );

        // Group walls by their exact endpoint coordinates.
        const junctions = new Map();

        const addToJunction = (point, wall) => {
            const key = `${point.x},${point.y}`;

            if (!junctions.has(key)) {
                junctions.set(key, new Set());
            }

            junctions.get(key).add(wall);
        };

        for (const wall of walls) {
            addToJunction(wall.start, wall);
            addToJunction(wall.end, wall);
        }

        // Collect individually valid two-wall joins.
        const candidates = [];

        for (const connectedWalls of junctions.values()) {
            // Skip branching junctions.
            if (connectedWalls.size !== 2) {
                continue;
            }

            const [wallA, wallB] = [...connectedWalls];

            let firstWall;
            let secondWall;

            if (
                wallA.end.x === wallB.start.x &&
                wallA.end.y === wallB.start.y
            ) {
                firstWall = wallA;
                secondWall = wallB;
            } else if (
                wallB.end.x === wallA.start.x &&
                wallB.end.y === wallA.start.y
            ) {
                firstWall = wallB;
                secondWall = wallA;
            } else {
                // Start-start and end-end are not supported yet.
                continue;
            }

            const result = GeometryService.getJoinedWallCorners(
                firstWall,
                secondWall
            );

            if (!result) {
                continue;
            }

            candidates.push({
                firstWall,
                secondWall,
                firstCorner: { ...result.wallACorners[2] },
                secondCorner: { ...result.wallBCorners[3] }
            });
        }

        // Track which joins are still allowed.
        const activeJoins = new Set(
            candidates.map((_, index) => index)
        );

        const buildGeometry = () => {
            // Always start with fresh original footprints.
            const geometryMap = new Map();

            for (const wall of walls) {
                geometryMap.set(wall.id, wall.getGeometry());
            }

            // Apply all active junction adjustments.
            for (const index of activeJoins) {
                const join = candidates[index];

                geometryMap.get(join.firstWall.id)[2] = {
                    ...join.firstCorner
                };

                geometryMap.get(join.secondWall.id)[3] = {
                    ...join.secondCorner
                };
            }

            return geometryMap;
        };

        // Rebuild until there are no invalid polygons.
        while (true) {
            const geometryMap = buildGeometry();

            const invalidWallIds = new Set();

            for (const wall of walls) {
                const corners = geometryMap.get(wall.id);

                if (!GeometryService.isSimplePolygon(corners)) {
                    invalidWallIds.add(wall.id);
                }
            }

            // All final wall footprints are valid.
            if (invalidWallIds.size === 0) {
                return geometryMap;
            }

            // Remove joins involving any invalid wall.
            const joinsToRemove = [];

            for (const index of activeJoins) {
                const join = candidates[index];

                if (
                    invalidWallIds.has(join.firstWall.id) ||
                    invalidWallIds.has(join.secondWall.id)
                ) {
                    joinsToRemove.push(index);
                }
            }

            // Safety fallback: return unmodified footprints
            // if no further conflicting joins can be removed.
            if (joinsToRemove.length === 0) {
                return new Map(
                    walls.map(wall => [
                        wall.id,
                        wall.getGeometry()
                    ])
                );
            }

            for (const index of joinsToRemove) {
                activeJoins.delete(index);
            }
        }
    }

    invalidateWallGeometry() {
        this.wallGeometryCache = null;
        this.wallGeometryElements = null;
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


    removeElement(id) {
        this.elements = this.elements.filter(
            element => element.id !== id
        );

        this.invalidateWallGeometry();
        this.render();
    }
}