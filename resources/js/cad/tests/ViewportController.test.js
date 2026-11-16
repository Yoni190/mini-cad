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
        viewport: { classList: { add: vi.fn(), remove: vi.fn() } },
        twoContainer: { style: { display: 'block' }, clientWidth: 800 },
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

it('shows both views, resizes the drawing surface, and syncs changes in split mode', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} });
    const canvas = {}, previewCanvas = {};
    const twoContainer = { style: { display: 'block' }, clientWidth: 400 };
    const threeContainer = { style: { display: 'none' } };
    const classes = { add: vi.fn(), remove: vi.fn() };
    const engine = { elements: [], getWallDisplayGeometry: vi.fn(() => []) };
    const viewport = new ViewportController({ canvas, previewCanvas, twoContainer, threeContainer, engine,
        viewport: { classList: classes }, view: { render: vi.fn() }, selectionManager: new SelectionManager() });
    viewport.showSplit();
    expect(classes.add).toHaveBeenCalledWith('split-view');
    expect(twoContainer.style.display).toBe('block');
    expect(threeContainer.style.display).toBe('block');
    expect(canvas.width).toBe(400);
    expect(viewport.threeViewer.updateElements).toHaveBeenCalledTimes(1);
    viewport.modelChanged();
    expect(viewport.threeViewer.updateElements).toHaveBeenCalledTimes(2);
    twoContainer.clientWidth = 800;
    viewport.show2D();
    expect(canvas.width).toBe(800);
    expect(threeContainer.style.display).toBe('none');
});
