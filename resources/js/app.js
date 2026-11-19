
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
    const wallPreviewRenderer = new WallPreviewRenderer({
        renderer,
        previewRenderer,
        snapManager,
        engine
    });
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
            'wallThickness', 'updateWallThickness', 'wallHeight', 'updateWallHeight',
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
    const blueprintFile = document.getElementById('blueprintFile');
    let blueprintLoad = 0;
    projects.onBlueprintChange = url => {
        const load = ++blueprintLoad;
        view.blueprint = null;
        editor.scheduleCanvasRender();
        if (!url) return;
        const image = new Image();
        image.onload = () => {
            if (load !== blueprintLoad) return;
            view.blueprint = image;
            editor.scheduleCanvasRender();
        };
        image.onerror = () => {
            if (load === blueprintLoad) controls.status.textContent = 'Could not load the blueprint image.';
        };
        image.src = `${url}?t=${Date.now()}`;
    };
    document.getElementById('uploadBlueprint').addEventListener('click', event => {
        event.currentTarget.closest('details').open = false;
        blueprintFile.click();
    });
    blueprintFile.addEventListener('change', async () => {
        const file = blueprintFile.files[0];
        blueprintFile.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            controls.status.textContent = 'Please select an image. PDF display is not available yet.';
            return;
        }
        if (projects.isGuest) {
            controls.status.textContent = 'Sign in to upload a blueprint.';
            return;
        }
        if (projects.isBusy || projects.isSaving) {
            controls.status.textContent = 'Please wait for the current project operation to finish.';
            return;
        }
        if (!projects.currentProjectId) await projects.save();
        if (!projects.currentProjectId) return;
        projects.setBusy(true);
        try {
            const data = new FormData();
            data.append('blueprint', file);
            const response = await fetch(`/projects/${projects.currentProjectId}/blueprint`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': projects.projectService.csrfToken },
                body: data,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Upload failed.');
            projects.onBlueprintChange(result.url);
            controls.status.textContent = 'Blueprint uploaded.';
        } catch (error) {
            controls.status.textContent = `Blueprint upload failed: ${error.message}`;
        } finally {
            projects.setBusy(false);
        }
    });
    document.getElementById('show3D').addEventListener('click', () => viewport.show3D());
    document.getElementById('showSplit').addEventListener('click', () => {
        viewport.showSplit();
        editor.scheduleCanvasRender();
    });
    document.getElementById('show2D').addEventListener('click', () => {
        viewport.show2D();
        editor.scheduleCanvasRender();
    });

    // Connect model changes to project state and both views in one place.
    engine.onModelChange = () => {
        projects.setUnsavedChanges(true);
        editor.scheduleCanvasRender();
        viewport.modelChanged();
    };

    projects.openInitialProject(document.getElementById('initialProject'));
    projects.restoreGuestDraft();
}
