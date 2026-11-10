import Wall from "./models/Wall";

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager) {
        this.canvas = canvas;
        this.engine = engine;
        this.renderer = renderer;
        this.snapManager = snapManager;
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
    }

    handleClick(event) {
        const point = this.getMousePoint(event);

        if(this.engine.startPoint === null) {
            this.engine.startPoint = point;
        } else {
            if (
                this.engine.startPoint.x === point.x &&
                this.engine.startPoint.y === point.y
            ) {
                this.engine.startPoint = null;
                this.engine.render();
                return;
            }

            this.engine.addWall(this.engine.startPoint, point);
            this.engine.startPoint = null;
        }
    }

    handleMouseMove(event) {
        if (this.engine.startPoint) {
            const point = this.getMousePoint(event);

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
}