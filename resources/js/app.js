
import './bootstrap';
import initEditorUI from './cad/editor-ui';
import CanvasRenderer from './cad/CanvasRenderer';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/EditorController';
import ProjectService from './cad/ProjectService';
import SelectionManager from './cad/SelectionManager';
import SnapManager from './cad/SnapManager';
import ThreeViewer from './cad/ThreeViewer';
import Wall from './cad/models/Wall';
import Column from './cad/models/Column';

const canvas = document.getElementById('cadCanvas');
const twoContainer = document.getElementById('twoContainer');
const threeContainer = document.getElementById('threeContainer');

if (canvas && twoContainer && threeContainer) {
    const renderer = new CanvasRenderer(canvas);
    const previewCanvas = document.getElementById('previewCanvas');
    const previewRenderer = new CanvasRenderer(previewCanvas);
    const engine = new DrawingEngine(renderer);
    const snapManager = new SnapManager();
    const selectionManager = new SelectionManager();
    const projectService = new ProjectService();
    const projectList = document.getElementById('projectList');
    const status = document.getElementById('saveStatus');
    let currentProjectId = null;

    let projectOperationInProgress = false;

    /**
     * Prevents overlapping project operations and locks editing while waiting.
     *
     * Keeping the committed drawing stable avoids edits racing with a save
     * or with the replacement of elements during a load.
     */
    function setProjectBusy(isBusy) {
        projectOperationInProgress = isBusy;

        // Disable project operations
        document.getElementById('saveProject').disabled = isBusy;
        document.getElementById('loadProject').disabled = isBusy;
        document.getElementById('newProject').disabled = isBusy;

        // Prevent changing the selected project during an operation.
        projectList.disabled = isBusy;

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


    async function refreshProjectList() {
        const projects = await projectService.getProjects();

        // Preserve the currently selected option
        const selectedId = projectList.value;

        // Clear existing options
        projectList.replaceChildren();

        const placeholder = new Option('Select a project', '');
        projectList.add(placeholder);

        for (const project of projects) {
            const option = new Option(project.name, String(project.id));
            projectList.add(option);
        }

        // Restore selection if the project still exists
        projectList.value = selectedId;
    }

    // Load available projects when the editor opens
    refreshProjectList().catch(error => {
        status.textContent = `Could not load project list: ${error.message}`;
    });

    const editor = new EditorController(
        canvas,
        engine,
        renderer,
        snapManager,
        selectionManager
    );

    editor.previewRenderer = previewRenderer;

    editor.init();
    initEditorUI();
    engine.render();

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

    // A 2D redraw only needs to clear the temporary preview.
    engine.onRender = () => {
        previewRenderer.clear();
    };

    // Model changes can require new 3D geometry.
    engine.onModelChange = () => {
        threeNeedsSync = true;
        syncThreeIfVisible();
    };

    document.getElementById('show3D').addEventListener('click', () => {
        twoContainer.style.display = 'none';
        threeContainer.style.display = 'block';

        if (!threeViewer) {
            threeViewer = new ThreeViewer(threeContainer);
        }

        threeViewer.setVisible(true);
        syncThreeIfVisible();
    });

    // Switch back to 2D
    document.getElementById('show2D').addEventListener('click', () => {
        threeViewer?.setVisible(false);
        threeContainer.style.display = 'none';
        twoContainer.style.display = 'block';

        engine.render();
    });

    //Save a project
    document.getElementById('saveProject')
        .addEventListener('click', async () => {
            // Check if an operation is in progress to protect against save-state race
            if (projectOperationInProgress) return;

            const saveButton = document.getElementById('saveProject');
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

                status.textContent =
                    `Project "${project.name}" saved successfully!`;

                // Refresh dropdown
                try {
                    await refreshProjectList();
                    projectList.value = String(currentProjectId);
                } catch (error) {
                    status.textContent +=
                        ` (Project list could not refresh: ${error.message})`;
                }
            } catch (error) {
                status.textContent = `Save failed: ${error.message}`;
                return;

            } finally {
                setProjectBusy(false);
            }
        });

    //Load a project
    document.getElementById('loadProject')
        .addEventListener('click', async () => {
            // Check if an operation is in progress to protect against save-state race
            if (projectOperationInProgress) return;

            const confirmed = window.confirm(
                'Loading a project will replace your current drawing. Continue?'
            );

            if (!confirmed) {
                return;
            }
            const projectId = projectList.value;
            const loadButton = document.getElementById('loadProject');

            if (!projectId) {
                status.textContent = 'Please select a project first.';
                return;
            }

            setProjectBusy(true);

            try {
                status.textContent = 'Loading project...';

                // 1. Fetch the project from Laravel
                const project = await projectService.loadProject(projectId);

                // JSON preserves properties but not class methods. Reconstructing
                // instances restores getGeometry() and runs constructor validation.
                // 2. Reconstruct actual Wall and Column instances
                // Do this BEFORE modifying the current drawing.
                const elements = project.elements.map(element => {
                    if (element.type === 'wall') {
                        return new Wall(element);
                    }

                    if (element.type === 'column') {
                        return new Column(element);
                    }

                    throw new Error(
                        `Unsupported element type: ${element.type}`
                    );
                });

                // 3. All elements were reconstructed successfully.
                // We can now safely replace the current drawing.
                engine.elements = elements;

                // The new array may contain different walls and joins.
                engine.invalidateWallGeometry();
                currentProjectId = project.id;

                // 4. Clear temporary editor state
                engine.startPoint = null;
                editor.directionPoint = null;
                editor.isDragging = false;
                selectionManager.clear();

                // 5. Update the 2D canvas
                engine.render();

                // 6. Display the loaded project name
                document.getElementById('projectName').value = project.name;

                status.textContent =
                    `Project "${project.name}" loaded successfully!`;

            } catch (error) {
                status.textContent =
                    `Load failed: ${error.message}`;
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
            engine.elements = [];
            engine.invalidateWallGeometry();

            // Reset current project
            currentProjectId = null;

            // Reset editor state
            engine.startPoint = null;
            editor.directionPoint = null;
            editor.isDragging = false;
            selectionManager.clear();

            // Clear project name and selection
            document.getElementById('projectName').value = '';
            projectList.value = '';

            // Refresh both views
            engine.render();

            status.textContent = 'New project created.';
        });

}
