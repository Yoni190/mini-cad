import './bootstrap';
import CanvasRenderer from './cad/CanvasRenderer';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/EditorController';
import SelectionManager from './cad/SelectionManager';
import SnapManager from './cad/SnapManager';
import ThreeViewer from './cad/ThreeViewer';

const canvas = document.getElementById('cadCanvas');

if (canvas) {
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

    const threeContainer = document.getElementById('threeContainer');

    if(threeContainer) {
        const threeViewer = new ThreeViewer(threeContainer);
    }
}