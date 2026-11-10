import './bootstrap';
import CanvasRenderer from './cad/CanvasRenderer';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/EditorController';
import Column from './cad/models/Column';
import SelectionManager from './cad/SelectionManager';
import SnapManager from './cad/SnapManager';


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
}