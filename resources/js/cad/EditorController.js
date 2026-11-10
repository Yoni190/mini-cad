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
                this.engine.render();
            })
    }

    handleClick(event) {
        const point = this.getMousePoint(
            event,
            this.activeTool !== 'select'
        );

        if(this.activeTool === 'select') {
            const selected = this.selectionManager.select(
                point,
                this.engine.elements
            );

            this.engine.render(null, selected?.id ?? null);
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
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.engine.startPoint = null;
            this.directionPoint = null;
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