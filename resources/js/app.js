
import './bootstrap';
import CanvasRenderer from './cad/CanvasRenderer';
import DrawingEngine from './cad/DrawingEngine';
import EditorController from './cad/EditorController';
import ProjectService from './cad/ProjectService';
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
    const projectService = new ProjectService();

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

    //Save a project
    document.getElementById('saveProject')
        .addEventListener('click', async () => {
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

            saveButton.disabled = true;

            try {
                status.textContent = 'Saving...';

                // Send the current elements to Laravel
                const project = await projectService.saveProject(
                    name,
                    engine.elements
                );

                status.textContent =
                    `Project "${project.name}" saved successfully!`;

                console.log('Saved project:', project);

            } catch (error) {
                // Keep the drawing unchanged if saving fails
                status.textContent = `Save failed: ${error.message}`;
            } finally {
                saveButton.disabled = false;
            }
        });

}
