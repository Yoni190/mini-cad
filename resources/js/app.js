
import './bootstrap';
import initEditorUI from './cad/ui/editor-ui';
import CanvasRenderer from './cad/rendering/CanvasRenderer';
import DrawingView from './cad/rendering/DrawingView';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/interaction/EditorController';
import ProjectService from './cad/persistence/ProjectService';
import restoreElements from './cad/persistence/restoreElements';
import SelectionManager from './cad/interaction/SelectionManager';
import SnapManager from './cad/interaction/SnapManager';
import ThreeViewer from './cad/rendering/ThreeViewer';

const canvas = document.getElementById('cadCanvas');
const twoContainer = document.getElementById('twoContainer');
const threeContainer = document.getElementById('threeContainer');

if (canvas && twoContainer && threeContainer) {
    const renderer = new CanvasRenderer(canvas);
    const previewCanvas = document.getElementById('previewCanvas');
    const previewRenderer = new CanvasRenderer(previewCanvas);
    const engine = new DrawingEngine();
    const view = new DrawingView(engine, renderer, previewRenderer);
    const snapManager = new SnapManager();
    const selectionManager = new SelectionManager();
    const projectService = new ProjectService();
    const status = document.getElementById('saveStatus');
    let currentProjectId = null;

    const changesStatus = document.getElementById('changesStatus');
    const projectNameInput = document.getElementById('projectName');

    let hasUnsavedChanges = false;

    function setUnsavedChanges(value) {
        if (hasUnsavedChanges === value) return;

        hasUnsavedChanges = value;
        changesStatus.dataset.unsaved = String(value);

        changesStatus.textContent = value
            ? 'Unsaved changes'
            : 'Saved.';
    }

    projectNameInput.addEventListener('input', () => {
        setUnsavedChanges(true);
    });

    projectNameInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            projectNameInput.blur();
        }
    });

    projectNameInput.addEventListener('blur', () => {
        const name = projectNameInput.value.trim() || 'Untitled Project';
        if (projectNameInput.value !== name) {
            projectNameInput.value = name;
            setUnsavedChanges(true);
        }
    });

    let projectOperationInProgress = false;

    /**
     * Prevents overlapping project operations and locks editing while waiting.
     *
     * Keeping the committed drawing stable avoids edits racing with a save
     * while the save request is pending.
     */
    function setProjectBusy(isBusy) {
        projectOperationInProgress = isBusy;
        projectNameInput.disabled = isBusy;

        // Disable project operations
        document.getElementById('saveProject').disabled = isBusy;
        document.getElementById('newProject').disabled = isBusy;

        // Disable drawing controls
        document.getElementById('drawingTool').disabled = isBusy;
        document.getElementById('wallLength').disabled = isBusy;
        document.getElementById('applyWallLength').disabled = isBusy;
        document.getElementById('updateColumn').disabled = isBusy;
        document.getElementById('wallThickness').disabled = isBusy;
        document.getElementById('updateWallThickness').disabled = isBusy;

        // Prevent interaction with the 2D canvas
        canvas.style.pointerEvents = isBusy ? 'none' : '';

        // Prevent keyboard shortcuts and other editor actions
        editor.setEditingLocked(isBusy);
    }


    const editor = new EditorController(
        canvas,
        engine,
        renderer,
        snapManager,
        selectionManager,
        view
    );

    editor.previewRenderer = previewRenderer;

    editor.init();
    initEditorUI();
    view.render();

    // Create the 3D viewer only when it is first opened.
    let threeViewer = null;

    // The first time 3D opens, it needs the current drawing.
    let threeNeedsSync = true;

    function syncThreeIfVisible() {
        if (
            !threeViewer ||
            threeContainer.style.display === 'none' ||
            !threeNeedsSync
        ) {
            return;
        }

        threeViewer.updateElements(
            engine.elements,
            engine.getWallDisplayGeometry()
        );

        threeNeedsSync = false;
    }

    // Keep the backing buffers in step with the displayed viewport so that
    // one canvas pixel continues to match one pointer coordinate.
    function resizeViews() {
        const viewport = document.querySelector('.canvas-viewport');
        const width = viewport.clientWidth;
        const height = 600;
        if (!width) return;

        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = previewCanvas.width = width;
            canvas.height = previewCanvas.height = height;
            view.render(selectionManager.selectedElement?.id ?? null);
        }
        threeViewer?.resize();
    }

    new ResizeObserver(resizeViews).observe(document.querySelector('.canvas-viewport'));
    resizeViews();

    // The app connects model changes to the 2D and 3D views.
    engine.onModelChange = () => {
        setUnsavedChanges(true);
        
        editor.scheduleCanvasRender();
        threeNeedsSync = true;
        syncThreeIfVisible();
    };

    const initialProject = document.getElementById('initialProject');
    if (initialProject) {
        try {
            const project = JSON.parse(initialProject.textContent);
            const elements = restoreElements(project.elements);
            engine.replaceElements(elements);
            currentProjectId = project.id;
            projectNameInput.value = project.name;
            setUnsavedChanges(false);
            status.textContent = `Project "${project.name}" loaded.`;
        } catch (error) {
            setProjectBusy(true);
            status.textContent = `Could not open project: ${error.message}. Return to Projects to try again.`;
        }
        initialProject.remove();
    }

    document.getElementById('show3D').addEventListener('click', () => {
        twoContainer.style.display = 'none';
        threeContainer.style.display = 'block';

        if (!threeViewer) {
            threeViewer = new ThreeViewer(threeContainer);
        }

        threeViewer.setVisible(true);
        threeViewer.resize();
        syncThreeIfVisible();
    });

    // Switch back to 2D
    document.getElementById('show2D').addEventListener('click', () => {
        threeViewer?.setVisible(false);
        threeContainer.style.display = 'none';
        twoContainer.style.display = 'block';

        view.render();
    });

    //Save a project
    document.getElementById('saveProject')
        .addEventListener('click', async () => {
            // Check if an operation is in progress to protect against save-state race
            if (projectOperationInProgress) return;

            const status = document.getElementById('saveStatus');

            const name = document
                .getElementById('projectName')
                .value.trim();

            // Validate the project name before sending
            if (!name) {
                status.textContent = 'Please enter a project name.';
                return;
            }

            setProjectBusy(true);

            let project;

            try {
                status.textContent = 'Saving...';

                project = currentProjectId
                    ? await projectService.updateProject(
                        currentProjectId,
                        name,
                        engine.elements
                    )
                    : await projectService.saveProject(
                        name,
                        engine.elements
                    );

                currentProjectId = project.id;
                window.history.replaceState(null, '', `/editor/${project.id}`);
                setUnsavedChanges(false);

                status.textContent =
                    `Project "${project.name}" saved successfully!`;

            } catch (error) {
                status.textContent = `Save failed: ${error.message}`;
                return;

            } finally {
                setProjectBusy(false);
            }
        });

    // Create a new project
    document.getElementById('newProject')
        .addEventListener('click', () => {
            // Check if an operation is in progress to protect against save-state race
            if (projectOperationInProgress) return;
            
            const confirmed = window.confirm(
                'Create a new project? Current unsaved changes will be lost.'
            );

            if (!confirmed) {
                return;
            }

            // Clear project data
            engine.replaceElements([]);

            // Reset current project
            currentProjectId = null;
            window.history.replaceState(null, '', '/editor');

            // Reset editor state
            editor.cancelWallDrawing();
            editor.isDragging = false;
            selectionManager.clear();

            // Reset project name
            document.getElementById('projectName').value = 'Untitled Project';
            setUnsavedChanges(false);

            status.textContent = 'New project created.';
        });

}
