import restoreElements from './restoreElements';

/** Owns the active project's identity, dirty state, and save/load lifecycle. */
export default class ProjectController {
    constructor({ engine, editor, projectService, controls, canvas }) {
        Object.assign(this, { engine, editor, projectService, controls, canvas });
        this.currentProjectId = null;
        this.currentProjectVersion = null;
        this.hasUnsavedChanges = false;
        this.isBusy = false;
        this.isGuest = document.body.dataset.authenticated !== 'true';
        this.guestDraftKey = 'miniCadGuestDraft';
        this.allowNavigation = false;
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

        if (this.isGuest) {
            try {
                localStorage.setItem(this.guestDraftKey, JSON.stringify({
                    name,
                    elements: this.engine.elements
                }));

                this.allowNavigation = true;
                window.location.assign('/register');
            } catch (error) {
                this.controls.status.textContent =
                    'Could not store your drawing locally. Check browser storage and try again.';
            }

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
            localStorage.removeItem(this.guestDraftKey);
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

    async restoreGuestDraft() {
        if (this.isGuest || this.currentProjectId !== null) return;

        let draft;

        try {
            const stored = localStorage.getItem(this.guestDraftKey);
            if (!stored) return;

            draft = JSON.parse(stored);

            if (
                !draft ||
                typeof draft.name !== 'string' ||
                !draft.name.trim() ||
                !Array.isArray(draft.elements)
            ) {
                throw new Error('Invalid guest draft.');
            }

            this.open({
                id: null,
                version: null,
                name: draft.name,
                elements: draft.elements
            });

            if (this.isBusy) return;

            this.setUnsavedChanges(true);
            await this.save();

        } catch (error) {
            this.controls.status.textContent =
                `Could not restore guest drawing: ${error.message}`;
        }
    }
}
