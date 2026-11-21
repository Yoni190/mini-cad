
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
    initEditorUI(view);
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
    const calibrationTool = document.getElementById('calibrateTool');
    const calibrationStatus = document.getElementById('calibrationStatus');
    const calibrationLength = document.getElementById('calibrationLength');
    const toolSelect = document.getElementById('drawingTool');
    let blueprintLoad = 0;
    let blueprintPath = null;
    editor.onCalibrationPoints = (start, end, message) => {
        calibrationStatus.textContent = message || (end
            ? 'Enter the known length and select Set scale.'
            : start ? 'Select the other end of the known distance.' : 'Select the first point.');
    };
    projects.onBlueprintChange = (url, path = null, scale = null, calibrate = false) => {
        const load = ++blueprintLoad;
        blueprintPath = path;
        view.blueprint = null;
        view.blueprintScale = scale == null ? null : Number(scale);
        calibrationTool.hidden = true;
        if (toolSelect.value === 'calibrate' || toolSelect.value === 'smart-tracing') {
            toolSelect.value = 'wall';
            toolSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        editor.scheduleCanvasRender();
        if (!url) return;
        const image = new Image();
        image.onload = () => {
            if (load !== blueprintLoad) return;
            view.blueprint = image;
            view.centerBlueprint();
            calibrationTool.hidden = false;
            if (calibrate) {
                toolSelect.value = 'calibrate';
                toolSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
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
            projects.onBlueprintChange(result.url, result.path, null, true);
            controls.status.textContent = 'Blueprint uploaded.';
        } catch (error) {
            controls.status.textContent = `Blueprint upload failed: ${error.message}`;
        } finally {
            projects.setBusy(false);
        }
    });
    document.getElementById('applyCalibration').addEventListener('click', async () => {
        const start = editor.measureStart;
        const end = editor.measureDone && editor.measureEnd;
        const length = Number(calibrationLength.value);
        const distance = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;
        if (!distance) {
            calibrationStatus.textContent = 'Select two different points on the blueprint.';
            return;
        }
        if (!Number.isFinite(length) || length <= 0) {
            calibrationStatus.textContent = 'Enter a positive length in millimeters.';
            return;
        }
        const currentScale = view.blueprintMillimetersPerPixel;
        const scale = currentScale * length / distance;
        if (!Number.isFinite(scale) || scale <= 0 || scale > 1000000000) {
            calibrationStatus.textContent = 'The resulting scale is outside the supported range.';
            return;
        }
        if (projects.isBusy || projects.isSaving) {
            calibrationStatus.textContent = 'Wait for the current project operation to finish.';
            return;
        }
        projects.setBusy(true);
        try {
            const response = await fetch(`/projects/${projects.currentProjectId}/blueprint/scale`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': projects.projectService.csrfToken,
                },
                body: JSON.stringify({ path: blueprintPath, scale }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Could not save the scale.');
            view.blueprintScale = result.scale;
            editor.scheduleCanvasRender();
            calibrationStatus.textContent = 'Blueprint scale saved.';
        } catch (error) {
            calibrationStatus.textContent = `Calibration failed: ${error.message}`;
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
