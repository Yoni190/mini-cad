import Wall from "./models/Wall";
import Column from "./models/Column";
import GeometryService from "./GeometryService";

export default class DrawingEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.elements = [];
        this.startPoint = null;
        this.onRender = null;
    }

    addWall(start, end) {
        //Create a wall instance
        const wall = new Wall({
            start,
            end
        });

        //Add the wall to this.elements
        this.elements.push(wall);

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

    getWallDisplayGeometry() {
        // Collect all walls in the drawing.
        const walls = this.elements.filter(
            element => element.type === 'wall'
        );

        // Store each wall's original footprint.
        const geometryMap = new Map();

        for (const wall of walls) {
            geometryMap.set(wall.id, wall.getGeometry());
        }

        // Group walls by their endpoint coordinates.
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

        // Process every endpoint junction.
        for (const connectedWalls of junctions.values()) {

            // Only join when exactly two walls meet.
            // Three-way and four-way junctions remain unmodified.
            if (connectedWalls.size !== 2) {
                continue;
            }

            const [wallA, wallB] = [...connectedWalls];

            let firstWall;
            let secondWall;

            // GeometryService currently supports:
            // firstWall.end === secondWall.start

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
                // Start-start or end-end joins are not
                // supported by the current geometry algorithm.
                continue;
            }

            const result = GeometryService.getJoinedWallCorners(
                firstWall,
                secondWall
            );

            if (!result) {
                continue;
            }

            // Keep existing adjustments at OTHER endpoints.
            // Do not replace the entire wall corner arrays.

            const firstCorners = geometryMap.get(firstWall.id);
            const secondCorners = geometryMap.get(secondWall.id);

            // Outer corner at firstWall.end
            firstCorners[2] = { ...result.wallACorners[2] };

            // Outer corner at secondWall.start
            secondCorners[3] = { ...result.wallBCorners[3] };
        }

        return geometryMap;
    }

    removeElement(id) {
        this.elements = this.elements.filter(
            element => element.id !== id
        );

        this.render();
    }
}