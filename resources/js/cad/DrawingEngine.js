import Wall from "./models/Wall";
import Column from "./models/Column";
import GeometryService from "./GeometryService";

export default class DrawingEngine {
    constructor(renderer) {
        this.renderer = renderer;
        this.elements = [];
        this.startPoint = null;
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
        // Map each wall ID to the polygon used for rendering
        const geometryMap = new Map();

        // Get only walls
        const walls = this.elements.filter(
            element => element.type === 'wall'
        );

        // Start with each wall's original geometry
        for (const wall of walls) {
            geometryMap.set(wall.id, wall.getGeometry());
        }

        // Check each unique pair of walls
        for (let i = 0; i < walls.length; i++) {
            for (let j = i + 1; j < walls.length; j++) {
                const wallA = walls[i];
                const wallB = walls[j];

                const joined =
                    GeometryService.getJoinedWallCorners(wallA, wallB) ??
                    GeometryService.getJoinedWallCorners(wallB, wallA);

                if (joined) {
                    geometryMap.set(wallA.id, joined.wallACorners);
                    geometryMap.set(wallB.id, joined.wallBCorners);
                }
            }
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