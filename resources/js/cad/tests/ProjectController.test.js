import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProjectController from '../persistence/ProjectController';

afterEach(() => vi.unstubAllGlobals());

describe('project lifecycle', () => {
    let projects, controls, engine, service;
    beforeEach(() => {
        vi.stubGlobal('window', { history: { replaceState: vi.fn() }, confirm: vi.fn(() => true) });
        controls = {
            name: { value: 'Plan' }, status: { textContent: '' },
            changesStatus: { dataset: {}, textContent: 'Saved.' },
            busyControls: [{ disabled: false }],
        };
        engine = { elements: [], replaceElements: vi.fn() };
        service = { saveProject: vi.fn(), updateProject: vi.fn() };
        projects = new ProjectController({
            engine, controls, projectService: service, canvas: { style: {} },
            editor: { setEditingLocked: vi.fn(), cancelInteraction: vi.fn() },
        });
        engine.replaceElements.mockImplementation(elements => {
            engine.elements = elements;
            projects.setUnsavedChanges(true);
        });
    });

    it('blocks overlapping operations and updates the created project on subsequent saves', async () => {
        let finish;
        service.saveProject.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        projects.setUnsavedChanges(true);
        const pending = projects.save();
        expect(projects.isBusy).toBe(true);
        expect(controls.busyControls[0].disabled).toBe(true);
        await projects.save();
        projects.createNew();
        expect(service.saveProject).toHaveBeenCalledTimes(1);
        expect(window.confirm).not.toHaveBeenCalled();
        finish({ id: 7, name: 'Plan', version: 1 });
        await pending;
        expect(projects.hasUnsavedChanges).toBe(false);
        expect(projects.isBusy).toBe(false);
        expect(controls.busyControls[0].disabled).toBe(false);
        service.updateProject.mockResolvedValue({ id: 7, name: 'Plan', version: 2 });
        await projects.save();
        expect(service.updateProject).toHaveBeenCalledWith(7, 'Plan', engine.elements, 1);
        expect(projects.currentProjectVersion).toBe(2);
    });

    it('retains unsaved changes and unlocks after a failed save', async () => {
        projects.setUnsavedChanges(true);
        service.saveProject.mockRejectedValue(new Error('Offline'));
        await projects.save();
        expect(projects.hasUnsavedChanges).toBe(true);
        expect(projects.isBusy).toBe(false);
        expect(controls.status.textContent).toBe('Save failed: Offline');
    });

    it('keeps local changes and the original version after a conflict', async () => {
        projects.open({ id: 8, name: 'Existing', elements: [], version: 1 });
        projects.setUnsavedChanges(true);
        service.updateProject.mockRejectedValue(new Error('Changed in another tab'));
        await projects.save();
        expect(projects.hasUnsavedChanges).toBe(true);
        expect(projects.currentProjectVersion).toBe(1);
        expect(controls.status.textContent).toContain('Changed in another tab');
    });

    it('opens a project as clean and resets identity when creating a new project', () => {
        projects.open({ id: 8, name: 'Existing', elements: [], version: 3 });
        expect(projects.currentProjectVersion).toBe(3);
        expect(projects.currentProjectId).toBe(8);
        expect(projects.hasUnsavedChanges).toBe(false);
        projects.createNew();
        expect(projects.currentProjectId).toBeNull();
        expect(projects.currentProjectVersion).toBeNull();
        expect(projects.editor.cancelInteraction).toHaveBeenCalledWith({ clearSelection: true });
        expect(projects.hasUnsavedChanges).toBe(false);
        expect(controls.name.value).toBe('Untitled Project');
        expect(window.history.replaceState).toHaveBeenLastCalledWith(null, '', '/editor');
    });

    it('locks editing if the initial JSON is corrupt', () => {
        const payload = { textContent: '{', remove: vi.fn() };
        projects.openInitialProject(payload);
        expect(projects.isBusy).toBe(true);
        expect(engine.replaceElements).not.toHaveBeenCalled();
        expect(payload.remove).toHaveBeenCalledOnce();
    });

    it('preserves the drawing when saved geometry is invalid', () => {
        projects.open({ id: 9, name: 'Invalid', elements: [{ type: 'unknown' }] });
        expect(engine.replaceElements).not.toHaveBeenCalled();
        expect(projects.isBusy).toBe(true);
        expect(projects.currentProjectId).toBeNull();
    });
});
