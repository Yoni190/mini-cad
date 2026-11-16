import ThreeViewer from './ThreeViewer';

/** Coordinates viewport size, view switching, and lazy 3D synchronization. */
export default class ViewportController {
    constructor({ canvas, previewCanvas, viewport, twoContainer, threeContainer, engine, view, selectionManager }) {
        Object.assign(this, { canvas, previewCanvas, viewport, twoContainer, threeContainer, engine, view, selectionManager });
        this.threeViewer = null;
        this.threeNeedsSync = true;
        this.resizeObserver = new ResizeObserver(() => this.resize());
    }

    init() {
        this.resizeObserver.observe(this.viewport);
        this.resizeObserver.observe(this.twoContainer);
        this.resize();
    }

    resize() {
        const width = this.twoContainer.clientWidth;
        const height = 600;
        // Match canvas backing buffers to pointer coordinates in the viewport.
        if (width && (this.canvas.width !== width || this.canvas.height !== height)) {
            this.canvas.width = this.previewCanvas.width = width;
            this.canvas.height = this.previewCanvas.height = height;
            this.view.render(this.selectionManager.selectedIds);
        }
        this.threeViewer?.resize();
    }

    modelChanged() {
        this.threeNeedsSync = true;
        this.syncThreeIfVisible();
    }

    syncThreeIfVisible() {
        if (!this.threeViewer || this.threeContainer.style.display === 'none' || !this.threeNeedsSync) return;
        this.threeViewer.updateElements(this.engine.elements, this.engine.getWallDisplayGeometry());
        this.threeNeedsSync = false;
    }

    show3D() {
        this.viewport.classList.remove('split-view');
        this.twoContainer.style.display = 'none';
        this.threeContainer.style.display = 'block';
        if (!this.threeViewer) this.threeViewer = new ThreeViewer(this.threeContainer);
        this.threeViewer.setVisible(true);
        this.threeViewer.resize();
        this.syncThreeIfVisible();
    }

    show2D() {
        this.viewport.classList.remove('split-view');
        this.threeViewer?.setVisible(false);
        this.threeContainer.style.display = 'none';
        this.twoContainer.style.display = 'block';
        this.resize();
        this.view.render(this.selectionManager.selectedIds);
    }

    showSplit() {
        this.viewport.classList.add('split-view');
        this.twoContainer.style.display = 'block';
        this.threeContainer.style.display = 'block';
        if (!this.threeViewer) this.threeViewer = new ThreeViewer(this.threeContainer);
        this.threeViewer.setVisible(true);
        this.resize();
        this.syncThreeIfVisible();
    }
}
