import GeometryService from "./GeometryService";
import Wall from "./models/Wall";

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager, selectionManager) {
        this.canvas = canvas;
        this.engine = engine;
        this.renderer = renderer;
        this.snapManager = snapManager;
        this.activeTool = 'wall';
        this.directionPoint = null;
        this.selectionManager = selectionManager;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = null;
    }

    init() {
        this.canvas.addEventListener('click', (event) => {
            this.handleClick(event);
        });

        this.canvas.addEventListener('mousemove', (event) => {
            this.handleMouseMove(event);
        });

        this.canvas.addEventListener('mousedown', (event) => {
            this.handleMouseDown(event);
        });

        this.canvas.addEventListener(
            'wheel',
            (event) => this.handleWheel(event),
            { passive: false }
        );

        this.canvas.addEventListener('auxclick', (event) => {
            if (event.button === 1) {
                event.preventDefault();
            }
        });

        window.addEventListener('mouseup', () => {
            this.handleMouseUp();
        });

        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        document.getElementById('applyWallLength')
            .addEventListener('click', () => {
                const input = document.getElementById('wallLength');

                const length = Number(input.value);

                if (!Number.isFinite(length) || length <= 0) {
                    alert('Please enter a positive wall length.');
                    return;
                }

                this.createWallWithLength(length);
            })
        
        document.getElementById('drawingTool')
            .addEventListener('change', (event) => {
                this.activeTool = event.target.value;

                this.engine.startPoint = null;
                this.directionPoint = null;
                this.isDragging = false;
                this.selectionManager.clear();

                this.engine.render();
            });

        document.getElementById('updateColumn')
            .addEventListener('click', () => {
                const selected = this.selectionManager.selectedElement;

                if (!selected || selected.type !== 'column') {
                    alert('Please select a column first.');
                    return;
                }

                //Check that a column is selected
                if(this.activeTool === 'select') {
                    //Convert column dimensions input values into numbers
                    const width = Number(document.getElementById('columnWidth').value);
                    const depth = Number(document.getElementById('columnDepth').value);

                    if (
                        !Number.isFinite(width) || width <= 0 ||
                        !Number.isFinite(depth) || depth <= 0
                    ) {
                        alert('Width and depth must be positive numbers.');
                        return;
                    }

                    this.engine.updateColumnDimensions(selected.id, width, depth);

                    this.engine.render(null, selected.id);
                }
            });
    }

    handleClick(event) {
        if (event.button !== 0) {
            return;
        }
        
        const point = this.getMousePoint(
            event,
            this.activeTool !== 'select'
        );

        if(this.activeTool === 'select') {
            const selected = this.selectionManager.select(
                point,
                this.engine.elements,
                this.engine.getWallDisplayGeometry()
            );

            this.engine.render(null, selected?.id ?? null);
            if(selected?.type === 'column') {
                document.getElementById('columnWidth').value = selected.width;
                document.getElementById('columnDepth').value = selected.depth;
            }
            return;
        }

        if(this.activeTool === 'column') {
            this.engine.addColumn(point);
            return;
        }

        if(this.engine.startPoint === null) {
            this.engine.startPoint = point;
            this.directionPoint = null;
        } else {
            if (
                this.engine.startPoint.x === point.x &&
                this.engine.startPoint.y === point.y
            ) {
                this.engine.startPoint = null;
                this.directionPoint = null;
                this.engine.render();
                return;
            }

            this.engine.addWall(this.engine.startPoint, point);
            this.engine.startPoint = null;
            this.directionPoint = null;
        }
    }

    handleMouseMove(event) {
        // Handle panning
        if (this.isPanning) {
            const dx = event.clientX - this.lastPanPoint.x;
            const dy = event.clientY - this.lastPanPoint.y;

            this.renderer.offsetX += dx;
            this.renderer.offsetY += dy;

            this.lastPanPoint = {
                x: event.clientX,
                y: event.clientY
            };

            this.engine.render(
                null,
                this.selectionManager.selectedElement?.id ?? null
            );

            return;
        }

        // Handle column dragging
        if (this.isDragging) {
            const point = this.getMousePoint(event, false);
            const column = this.selectionManager.selectedElement;

            if (!column) {
                this.isDragging = false;
                return;
            }

            column.position = {
                x: point.x - this.dragOffset.x,
                y: point.y - this.dragOffset.y
            };

            this.engine.render(null, column.id);
            return;
        }

        if (this.activeTool === 'wall' && this.engine.startPoint) {
            const point = this.getMousePoint(event);

            this.directionPoint = point;

            if (
                this.engine.startPoint.x === point.x &&
                this.engine.startPoint.y === point.y
            ) {
                this.engine.render();
                return;
            }

            const wall = new Wall({
                start: this.engine.startPoint,
                end: point
            });

            this.engine.render(wall);
        }
    }

    handleMouseDown(event) {
        if (event.button === 1) {
            event.preventDefault();

            this.isPanning = true;

            this.lastPanPoint = {
                x: event.clientX,
                y: event.clientY
            };

            return;
        }

        if (this.activeTool !== 'select' || event.button !== 0) {
            return;
        }

        const column = this.selectionManager.selectedElement;

        if (!column || column.type !== 'column') {
            return;
        }

        const point = this.getMousePoint(event, false);

        if (!this.selectionManager.isPointInsideColumn(point, column)) {
            return;
        }

        this.dragOffset = {
            x: point.x - column.position.x,
            y: point.y - column.position.y
        };

        this.isDragging = true;
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isPanning = false;
        this.lastPanPoint = null;
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.engine.startPoint = null;
            this.directionPoint = null;
            this.isDragging = false;
            this.selectionManager.clear();

            this.engine.render();
        }

        if(
            this.activeTool === 'select' &&
            (event.key === 'Delete' || event.key === 'Backspace')
        ) {
            const tag = event.target?.tagName;

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
                return;
            }

            const selected = this.selectionManager.selectedElement;

            if (!selected) {
                return;
            }

            event.preventDefault();

            this.engine.removeElement(selected.id);
            this.selectionManager.clear();
        }
    }

    handleWheel(event) {
        event.preventDefault();

        // Get mouse position relative to the Canvas
        const rect = this.canvas.getBoundingClientRect();

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Find which world coordinate is under the cursor
        const worldPoint = this.renderer.screenToWorld(
            mouseX,
            mouseY
        );

        // Zoom in or out
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

        // Limit zoom so the drawing can't become
        // infinitely small or large
        const newScale = Math.min(
            2,
            Math.max(0.01, this.renderer.scale * zoomFactor)
        );

        this.renderer.scale = newScale;

        // Recalculate offsets so the world point
        // remains underneath the cursor
        this.renderer.offsetX =
            mouseX - worldPoint.x * newScale;

        this.renderer.offsetY =
            mouseY - worldPoint.y * newScale;

        // Redraw with the new scale and offsets
        this.engine.render(
            null,
            this.selectionManager.selectedElement?.id ?? null
        );
    }


    //Calculate mouse coordinates
    getMousePoint(event, applySnap = true) {
        //Read mouse coordinatess
        const rect = this.canvas.getBoundingClientRect();

        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        //Convert pixels to millimeters
        const rawPoint = this.renderer.screenToWorld(screenX, screenY);

        //Apply snapping (for walls)
        return applySnap
            ? this.snapManager.snap(rawPoint, this.engine.elements)
            : rawPoint;
    }

    createWallWithLength(length) {
        if(!this.engine.startPoint || !this.directionPoint) {
            alert('Click a starting point and move the mouse to choose a direction.');
            return;
        }
        if(this.engine.startPoint.x === this.directionPoint.x &&
            this.engine.startPoint.y === this.directionPoint.y
        ) {
            alert('Move the mouse to choose a wall direction first.');
            return;
        }

        const newEndpoint = GeometryService.getEndPoint(
            this.engine.startPoint,
            this.directionPoint,
            length
        );

        this.engine.addWall(this.engine.startPoint, newEndpoint);

        this.engine.startPoint = null;
        this.directionPoint = null;
    }
}