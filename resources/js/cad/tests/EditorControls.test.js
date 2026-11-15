import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import initEditorControls from '../ui/editor-controls';

afterEach(() => vi.unstubAllGlobals());

describe('editor property controls', () => {
    let controls, editor, document;
    beforeEach(() => {
        controls = Object.fromEntries([
            'wallLength', 'columnWidth', 'columnDepth', 'wallThickness',
            'applyWallLength', 'updateColumn', 'updateWallThickness', 'newWallThickness',
        ].map(id => [id, Object.assign(new EventTarget(), { value: '' })]));
        document = Object.assign(new EventTarget(), { getElementById: id => controls[id] });
        vi.stubGlobal('document', document);
        vi.stubGlobal('alert', vi.fn());
        editor = {
            applyWallLength: vi.fn(), updateSelectedColumnDimensions: vi.fn(),
            updateSelectedWallThickness: vi.fn(), refreshWallPreview: vi.fn(),
        };
        initEditorControls(editor);
    });

    it('passes numeric dimensions and raw thickness to the editor actions once', () => {
        controls.wallLength.value = '1200';
        controls.columnWidth.value = '300';
        controls.columnDepth.value = '400';
        controls.wallThickness.value = '250';
        for (const id of ['applyWallLength', 'updateColumn', 'updateWallThickness']) {
            controls[id].dispatchEvent(new Event('click'));
        }
        controls.newWallThickness.dispatchEvent(new Event('input'));
        expect(editor.applyWallLength).toHaveBeenCalledExactlyOnceWith(1200);
        expect(editor.updateSelectedColumnDimensions).toHaveBeenCalledExactlyOnceWith(300, 400);
        expect(editor.updateSelectedWallThickness).toHaveBeenCalledExactlyOnceWith('250');
        expect(editor.refreshWallPreview).toHaveBeenCalledOnce();
    });

    it.each(['applyWallLength', 'updateColumn', 'updateWallThickness'])('presents action errors from %s', id => {
        const action = { applyWallLength: 'applyWallLength', updateColumn: 'updateSelectedColumnDimensions', updateWallThickness: 'updateSelectedWallThickness' }[id];
        editor[action].mockImplementation(() => { throw new Error('Invalid value'); });
        controls[id].dispatchEvent(new Event('click'));
        expect(alert).toHaveBeenCalledWith('Invalid value');
    });

    it('updates selected properties and clears wall thickness on deselection', () => {
        const select = detail => {
            const event = Object.assign(new Event('cad-selection-change'), { detail });
            document.dispatchEvent(event);
        };
        select({ type: 'column', width: 300, depth: 400 });
        expect(controls.columnWidth.value).toBe(300);
        expect(controls.columnDepth.value).toBe(400);
        expect(controls.wallThickness.value).toBe('');
        select({ type: 'wall', thickness: 200 });
        expect(controls.wallThickness.value).toBe(200);
        select(null);
        expect(controls.wallThickness.value).toBe('');
        expect(controls.columnWidth.value).toBe(300);
    });
});
