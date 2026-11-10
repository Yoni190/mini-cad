
import './bootstrap';
import CanvasRenderer from './cad/CanvasRenderer';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/EditorController';
import SelectionManager from './cad/SelectionManager';
import SnapManager from './cad/SnapManager';
import ThreeViewer from './cad/ThreeViewer';

const canvas = document.getElementById('cadCanvas');
const twoContainer = document.getElementById('twoContainer');
const threeContainer = document.getElementById('threeContainer');

if (canvas && twoContainer && threeContainer) {
    const renderer = new CanvasRenderer(canvas);
    const engine = new DrawingEngine(renderer);
    const snapManager = new SnapManager();
    const selectionManager = new SelectionManager();

    const editor = new EditorController(
        canvas,
        engine,
        renderer,
        snapManager,
        selectionManager
    );

    editor.init();

    // Create Three.js viewer only when needed
    let threeViewer = null;

    // Switch to 3D
    document.getElementById('show3D').addEventListener('click', () => {
        twoContainer.style.display = 'none';
        threeContainer.style.display = 'block';

        if (!threeViewer) {
            threeViewer = new ThreeViewer(threeContainer);
        }

        // Render the same elements used by the 2D editor
        threeViewer.updateElements(engine.elements);
    });

    // Switch back to 2D
    document.getElementById('show2D').addEventListener('click', () => {
        threeContainer.style.display = 'none';
        twoContainer.style.display = 'block';

        engine.render();
    });
}
