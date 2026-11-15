/** Draws temporary wall visuals; drafting geometry and frame scheduling live elsewhere. */
export default class WallPreviewRenderer {
    constructor({ renderer, previewRenderer, snapManager }) {
        Object.assign(this, { renderer, previewRenderer, snapManager });
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
        this.previewRenderer.drawWallGuides(preview, elements);
        this.drawSnapMarker(preview.end, elements);
    }

    renderStartHints(point, elements) {
        this.prepareFrame();
        this.previewRenderer.drawWallGuides({ start: null, end: point }, elements);
        this.drawSnapMarker(point, elements);
    }

    drawSnapMarker(point, elements) {
        if (this.snapManager.isOnWall(point, elements)) {
            this.previewRenderer.drawSnapMarker(point);
        }
    }
}
