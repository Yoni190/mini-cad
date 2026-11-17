/** Draws temporary wall visuals; drafting geometry and frame scheduling live elsewhere. */
export default class WallPreviewRenderer {
    constructor({ renderer, previewRenderer, snapManager, engine }) {
        Object.assign(this, { renderer, previewRenderer, snapManager, engine });
    }

    clear() {
        this.previewRenderer.clear();
    }

    // Read the current transform each time so previews follow pan and zoom.
    prepareFrame() {
        this.previewRenderer.scale = this.renderer.scale;
        this.previewRenderer.offsetX = this.renderer.offsetX;
        this.previewRenderer.offsetY = this.renderer.offsetY;
        this.clear();
    }

    render(preview, elements) {
        this.prepareFrame();
        if (!preview) return;
        this.previewRenderer.drawElement(preview, true);
        this.previewRenderer.drawWallLength(preview);
        this.previewRenderer.drawWallAngle(preview, this.engine.findWallsNear(preview.start, 1e-6));
        this.previewRenderer.drawWallGuides(preview, elements);
        this.drawSnapMarker(preview.end);
    }

    renderSelectionBox(start, end) {
        this.prepareFrame();
        this.previewRenderer.drawSelectionBox(start, end);
    }

    renderStartHints(point, elements) {
        this.prepareFrame();
        this.previewRenderer.drawWallGuides({ start: null, end: point }, elements);
        this.drawSnapMarker(point);
    }

    drawSnapMarker(point) {
        const walls = this.engine.findWallsNear(point, 1e-6);

        if (this.snapManager.isOnWall(point, walls)) {
            this.previewRenderer.drawSnapMarker(point);
        }
    }

    renderMeasurement(start, end) {
        this.prepareFrame();

        if (start && end) {
            this.previewRenderer.drawMeasurement(start, end);
        }
    }
}
