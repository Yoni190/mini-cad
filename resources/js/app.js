import './bootstrap';
import CanvasRenderer from './cad/CanvasRenderer';
import DrawingEngine from './cad/DrawingEngine';
import Wall from './cad/models/Wall';

const canvas = document.getElementById('cadCanvas');

if (canvas) {
    const renderer = new CanvasRenderer(canvas);
    const engine = new DrawingEngine(renderer);

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();

        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        const point = renderer.screenToWorld(screenX, screenY);

        if(engine.startPoint === null) {
            engine.startPoint = point;
        } else {
            if (
                engine.startPoint.x === point.x &&
                engine.startPoint.y === point.y
            ) {
                engine.startPoint = null;
                engine.render();
                return;
            }

            engine.addWall(engine.startPoint, point);
            engine.startPoint = null;
        }
    });

    canvas.addEventListener('mousemove', (event) => {
        if (engine.startPoint) {
            const rect = canvas.getBoundingClientRect();

            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;

            const point = renderer.screenToWorld(screenX, screenY);

            if(
                engine.startPoint.x === point.x &&
                engine.startPoint.y === point.y
            ) {
                engine.render();
                return;
            }

            const wall = new Wall({
                start: engine.startPoint,
                end: point
            });

            engine.render(wall);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            engine.startPoint = null;
            engine.render();
        }
    })
}
