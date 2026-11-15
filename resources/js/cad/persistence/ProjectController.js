import restoreElements from './restoreElements';

/** Owns the active project's identity, dirty state, and save/load lifecycle. */
export default class ProjectController {
    constructor({ engine, editor, projectService, controls, canvas }) {
        Object.assign(this, { engine, editor, projectService, controls, canvas });
        this.currentProjectId = null;
        this.currentProjectVersion = null;
        this.hasUnsavedChanges = false;
        this.isBusy = false;
    }

    setUnsavedChanges(value) {
        if (this.hasUnsavedChanges === value) return;
        this.hasUnsavedChanges = value;
        this.controls.changesStatus.dataset.unsaved = String(value);
        this.controls.changesStatus.textContent = value ? 'Unsaved changes' : 'Saved.';
    }

    // Keep committed geometry stable and prevent overlapping project operations.
    setBusy(value) {
        this.isBusy = value;
        for (const control of this.controls.busyControls) control.disabled = value;
        this.canvas.style.pointerEvents = value ? 'none' : '';
        this.editor.setEditingLocked(value);
    }

    open(project) {
        try {
            const elements = restoreElements(project.elements);
            this.engine.replaceElements(elements);
            this.currentProjectId = project.id;
            this.currentProjectVersion = project.version;
            this.controls.name.value = project.name;
            this.setUnsavedChanges(false);
            this.controls.status.textContent = `Project "${project.name}" loaded.`;
        } catch (error) {
            this.setBusy(true);
            this.controls.status.textContent = `Could not open project: ${error.message}. Return to Projects to try again.`;
        }
    }

    openInitialProject(element) {
        if (!element) return;
        try {
            this.open(JSON.parse(element.textContent));
        } catch (error) {
            this.setBusy(true);
            this.controls.status.textContent = `Could not open project: ${error.message}. Return to Projects to try again.`;
        } finally {
            element.remove();
        }
    }

    async save() {
        if (this.isBusy) return;
        const name = this.controls.name.value.trim();
        if (!name) {
            this.controls.status.textContent = 'Please enter a project name.';
            return;
        }

        this.setBusy(true);
        try {
            this.controls.status.textContent = 'Saving...';
            const project = this.currentProjectId
                ? await this.projectService.updateProject(this.currentProjectId, name, this.engine.elements, this.currentProjectVersion)
                : await this.projectService.saveProject(name, this.engine.elements);

            this.currentProjectId = project.id;
            this.currentProjectVersion = project.version;
            window.history.replaceState(null, '', `/editor/${project.id}`);
            this.setUnsavedChanges(false);
            this.controls.status.textContent = `Project "${project.name}" saved successfully!`;
        } catch (error) {
            this.controls.status.textContent = `Save failed: ${error.message}`;
        } finally {
            this.setBusy(false);
        }
    }

    createNew() {
        if (this.isBusy) return;
        if (!window.confirm('Create a new project? Current unsaved changes will be lost.')) return;

        this.engine.replaceElements([]);
        this.currentProjectId = null;
        this.currentProjectVersion = null;
        window.history.replaceState(null, '', '/editor');
        this.editor.cancelInteraction({ clearSelection: true });
        this.controls.name.value = 'Untitled Project';
        this.setUnsavedChanges(false);
        this.controls.status.textContent = 'New project created.';
    }
}
