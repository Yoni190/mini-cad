/** Coordinates the 2D view of committed drawing elements. */
export default class DrawingView {
    constructor(engine, renderer, previewRenderer = null) {
        this.engine = engine;
        this.renderer = renderer;
        this.previewRenderer = previewRenderer;
    }

    /**
     * Redraws stored elements using their resolved display geometry.
     *
     * Temporary previews are drawn by WallPreviewRenderer when the editor requests it.
     */
    render(selectedIds = new Set()) {
        const wallGeometry = this.engine.getWallDisplayGeometry();

        this.renderer.clear();

        this.renderer.drawGrid();

        for (const element of this.engine.elements) {
            const isSelected = selectedIds.has(element.id);

            const corners = element.type === 'wall'
                ? wallGeometry.get(element.id) ?? element.getGeometry()
                : element.getGeometry();

            if (!this.renderer.isGeometryVisible(corners)) {
                continue;
            }

            this.renderer.drawElement(
                element,
                false,
                isSelected,
                corners
            );
        }

        // A full redraw replaces any temporary drawing preview.
        this.previewRenderer?.clear();
    }
}
