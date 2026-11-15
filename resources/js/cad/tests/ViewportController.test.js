import { afterEach, expect, it, vi } from 'vitest';
import SelectionManager from '../interaction/SelectionManager';
import ViewportController from '../rendering/ViewportController';
import ThreeViewer from '../rendering/ThreeViewer';

vi.mock('../rendering/ThreeViewer', () => ({
    default: vi.fn(function () {
        this.setVisible = vi.fn();
        this.resize = vi.fn();
        this.updateElements = vi.fn();
    }),
}));

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('defers 3D creation and synchronization until visible, then refreshes only changed geometry', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} });
    const canvas = {}, previewCanvas = {};
    const engine = { elements: [], getWallDisplayGeometry: vi.fn(() => []) };
    const view = { render: vi.fn() };
    const selection = new SelectionManager();
    selection.selectedElements = [{ id: 'selected' }];
    const viewport = new ViewportController({
        canvas, previewCanvas, engine, view,
        viewport: { clientWidth: 800 },
        twoContainer: { style: { display: 'block' } },
        threeContainer: { style: { display: 'none' } },
        selectionManager: selection,
    });
    viewport.init();
    expect(canvas).toEqual({ width: 800, height: 600 });
    expect(previewCanvas).toEqual(canvas);
    expect(view.render).toHaveBeenCalledWith(new Set(['selected']));
    viewport.modelChanged();
    expect(ThreeViewer).not.toHaveBeenCalled();
    viewport.show3D();
    const viewer = viewport.threeViewer;
    expect(viewer.updateElements).toHaveBeenCalledTimes(1);
    viewport.show2D();
    viewport.show3D();
    expect(viewer.updateElements).toHaveBeenCalledTimes(1);
    viewport.show2D();
    viewport.modelChanged();
    expect(viewer.updateElements).toHaveBeenCalledTimes(1);
    viewport.show3D();
    expect(ThreeViewer).toHaveBeenCalledTimes(1);
    expect(viewer.updateElements).toHaveBeenCalledTimes(2);
    viewport.modelChanged();
    expect(viewer.updateElements).toHaveBeenCalledTimes(3);
});
