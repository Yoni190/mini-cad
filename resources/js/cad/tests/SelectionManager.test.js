import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SelectionManager from '../interaction/SelectionManager';

beforeEach(() => vi.stubGlobal('document', { dispatchEvent: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

it('starts with no selected identity or property-panel element', () => {
    const selection = new SelectionManager();
    expect(selection.selectedElements).toEqual([]);
    expect(selection.selectedIds).toEqual(new Set());
    expect(selection.selectedElement).toBeNull();
});

it('publishes the sole selected element to property panels', () => {
    const selection = new SelectionManager();
    const wall = { id: 'wall', type: 'wall' };
    selection.setSelection([wall]);
    expect(selection.selectedElement).toBe(wall);
    expect(selection.selectedIds).toEqual(new Set(['wall']));
    const event = document.dispatchEvent.mock.calls[0][0];
    expect(event.type).toBe('cad-selection-change');
    expect(event.detail).toBe(wall);
});

it('keeps every selected identity while hiding single-element properties for groups', () => {
    const selection = new SelectionManager();
    const elements = [{ id: 'wall' }, { id: 'column' }];
    selection.setSelection(elements);
    expect(selection.selectedElements).toEqual(elements);
    expect(selection.selectedIds).toEqual(new Set(['wall', 'column']));
    expect(selection.selectedElement).toBeNull();
    expect(document.dispatchEvent.mock.calls[0][0].detail).toBeNull();
});

it('clears selection and tells property panels to close', () => {
    const selection = new SelectionManager();
    selection.setSelection([{ id: 'wall' }]);
    selection.clear();
    expect(selection.selectedElements).toEqual([]);
    expect(selection.selectedIds).toEqual(new Set());
    expect(selection.selectedElement).toBeNull();
    expect(document.dispatchEvent.mock.calls.at(-1)[0].detail).toBeNull();
});
