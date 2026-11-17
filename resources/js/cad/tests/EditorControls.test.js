import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import initEditorControls from '../ui/editor-controls';

afterEach(() => vi.unstubAllGlobals());

describe('editor property controls', () => {
    let controls, editor, document;
    beforeEach(() => {
        controls = Object.fromEntries([
            'wallLength', 'columnWidth', 'columnDepth', 'columnHeight', 'wallThickness', 'wallHeight',
            'applyWallLength', 'updateColumn', 'updateWallThickness', 'updateWallHeight', 'newWallThickness',
            'wallDoors', 'removeWallDoor',
        ].map(id => [id, Object.assign(new EventTarget(), { value: '' })]));
        Object.assign(controls.wallDoors, { replaceChildren: vi.fn(), appendChild: vi.fn() });
        document = Object.assign(new EventTarget(), { getElementById: id => controls[id], createElement: () => ({}) });
        vi.stubGlobal('document', document);
        vi.stubGlobal('alert', vi.fn());
        editor = {
            applyWallLength: vi.fn(), updateSelectedColumnDimensions: vi.fn(),
            updateSelectedWallThickness: vi.fn(), updateSelectedWallHeight: vi.fn(), refreshWallPreview: vi.fn(),
        };
        initEditorControls(editor);
    });

    it('passes numeric dimensions and raw thickness to the editor actions once', () => {
        controls.wallLength.value = '1200';
        controls.columnWidth.value = '300';
        controls.columnDepth.value = '400';
        controls.columnHeight.value = '3000';
        controls.wallThickness.value = '250';
        controls.wallHeight.value = '2800';
        for (const id of ['applyWallLength', 'updateColumn', 'updateWallThickness', 'updateWallHeight']) {
            controls[id].dispatchEvent(new Event('click'));
        }
        controls.newWallThickness.dispatchEvent(new Event('input'));
        expect(editor.applyWallLength).toHaveBeenCalledExactlyOnceWith(1200);
        expect(editor.updateSelectedColumnDimensions).toHaveBeenCalledExactlyOnceWith(300, 400, 3000);
        expect(editor.updateSelectedWallThickness).toHaveBeenCalledExactlyOnceWith('250');
        expect(editor.updateSelectedWallHeight).toHaveBeenCalledExactlyOnceWith('2800');
        expect(editor.refreshWallPreview).toHaveBeenCalledOnce();
    });

    it.each(['applyWallLength', 'updateColumn', 'updateWallThickness', 'updateWallHeight'])('presents action errors from %s', id => {
        const action = { applyWallLength: 'applyWallLength', updateColumn: 'updateSelectedColumnDimensions', updateWallThickness: 'updateSelectedWallThickness', updateWallHeight: 'updateSelectedWallHeight' }[id];
        editor[action].mockImplementation(() => { throw new Error('Invalid value'); });
        controls[id].dispatchEvent(new Event('click'));
        expect(alert).toHaveBeenCalledWith('Invalid value');
    });

    it('updates selected properties and clears wall thickness on deselection', () => {
        const select = detail => {
            const event = Object.assign(new Event('cad-selection-change'), { detail });
            document.dispatchEvent(event);
        };
        select({ type: 'column', width: 300, depth: 400, height: 3000 });
        expect(controls.columnWidth.value).toBe(300);
        expect(controls.columnDepth.value).toBe(400);
        expect(controls.columnHeight.value).toBe(3000);
        expect(controls.wallThickness.value).toBe('');
        select({ type: 'wall', thickness: 200, height: 3000, openings: [] });
        expect(controls.wallThickness.value).toBe(200);
        expect(controls.wallHeight.value).toBe(3000);
        select(null);
        expect(controls.wallHeight.value).toBe('');
        expect(controls.wallThickness.value).toBe('');
        expect(controls.columnWidth.value).toBe(300);
    });
});
