import GeometryService from "./GeometryService";
import Wall from "./models/Wall";

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager) {
        this.canvas = canvas;
        this.engine = engine;
        this.renderer = renderer;
        this.snapManager = snapManager;
        this.directionPoint = null;
    }

    init() {
        this.canvas.addEventListener('click', (event) => {
            this.handleClick(event);
        });

        this.canvas.addEventListener('mousemove', (event) => {
            this.handleMouseMove(event);
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
    }

    handleClick(event) {
        const point = this.getMousePoint(event);

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
        if (this.engine.startPoint) {
            const point = this.getMousePoint(event);

            this.directionPoint = point;

            if(
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

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.engine.startPoint = null;
            this.directionPoint = null;
            this.engine.render();
        }
    }

    //Calculate mouse coordinates
    getMousePoint(event) {
        //Read mouse coordinatess
        const rect = this.canvas.getBoundingClientRect();

        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        //Convert pixels to millimeters
        const rawPoint = this.renderer.screenToWorld(screenX, screenY);

        //Apply snapping
        return this.snapManager.snap(rawPoint, this.engine.elements);
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