
import './bootstrap';
import initEditorUI from './cad/ui/editor-ui';
import initEditorControls from './cad/ui/editor-controls';
import createWallInputs from './cad/ui/wall-inputs';
import CanvasRenderer from './cad/rendering/CanvasRenderer';
import DrawingView from './cad/rendering/DrawingView';
import WallPreviewRenderer from './cad/rendering/WallPreviewRenderer';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/interaction/EditorController';
import ProjectService from './cad/persistence/ProjectService';
import ProjectController from './cad/persistence/ProjectController';
import initProjectControls from './cad/ui/project-controls';
import SelectionManager from './cad/interaction/SelectionManager';
import SnapManager from './cad/interaction/SnapManager';
import ViewportController from './cad/rendering/ViewportController';

const canvas = document.getElementById('cadCanvas');
const twoContainer = document.getElementById('twoContainer');
const threeContainer = document.getElementById('threeContainer');

if (canvas && twoContainer && threeContainer) {
    const renderer = new CanvasRenderer(canvas);
    const previewCanvas = document.getElementById('previewCanvas');
    const previewRenderer = new CanvasRenderer(previewCanvas);
    const engine = new DrawingEngine();
    const snapManager = new SnapManager();
    const wallPreviewRenderer = new WallPreviewRenderer({ renderer, previewRenderer, snapManager });
    const view = new DrawingView(engine, renderer, wallPreviewRenderer);
    const selectionManager = new SelectionManager();
    const editor = new EditorController(
        canvas,
        engine,
        renderer,
        snapManager,
        selectionManager,
        view,
        createWallInputs(),
        wallPreviewRenderer
    );

    editor.init();
    initEditorUI();
    initEditorControls(editor);
    view.render();

    const controls = {
        name: document.getElementById('projectName'),
        status: document.getElementById('saveStatus'),
        changesStatus: document.getElementById('changesStatus'),
        save: document.getElementById('saveProject'),
        newProject: document.getElementById('newProject'),
        busyControls: [
            'projectName', 'saveProject', 'newProject', 'drawingTool',
            'wallLength', 'applyWallLength', 'updateColumn',
            'wallThickness', 'updateWallThickness',
        ].map(id => document.getElementById(id)),
    };
    const projects = new ProjectController({
        engine, editor, controls, canvas,
        projectService: new ProjectService(),
    });
    const viewport = new ViewportController({
        canvas, previewCanvas, twoContainer, threeContainer,
        engine, view, selectionManager,
        viewport: document.querySelector('.canvas-viewport'),
    });

    viewport.init();
    initProjectControls(projects, controls);
    document.getElementById('show3D').addEventListener('click', () => viewport.show3D());
    document.getElementById('show2D').addEventListener('click', () => viewport.show2D());

    // Connect model changes to project state and both views in one place.
    engine.onModelChange = () => {
        projects.setUnsavedChanges(true);
        editor.scheduleCanvasRender();
        viewport.modelChanged();
    };

    projects.openInitialProject(document.getElementById('initialProject'));
}
