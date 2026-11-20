import { wallSections } from '../geometry/wallSections';

/** Coordinates the 2D view of committed drawing elements. */
export default class DrawingView {
    constructor(engine, renderer, previewRenderer = null) {
        this.engine = engine;
        this.renderer = renderer;
        this.previewRenderer = previewRenderer;
    }

    get blueprintMillimetersPerPixel() {
        return this.blueprintScale ??
            Math.min(1000 / this.blueprint.width, 600 / this.blueprint.height) / 0.1;
    }

    centerBlueprint() {
        const { canvas, scale } = this.renderer;
        const pixelsPerImagePixel = scale * this.blueprintMillimetersPerPixel;
        this.renderer.offsetX = (canvas.width - this.blueprint.width * pixelsPerImagePixel) / 2;
        this.renderer.offsetY = (canvas.height - this.blueprint.height * pixelsPerImagePixel) / 2;
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

        if (this.blueprint) {
            const origin = this.renderer.worldToScreen(0, 0);
            const scale = this.renderer.scale * this.blueprintMillimetersPerPixel;
            this.renderer.ctx.drawImage(this.blueprint, origin.x, origin.y,
                this.blueprint.width * scale, this.blueprint.height * scale);
        }

        for (const element of this.engine.elements) {
            const isSelected = selectedIds.has(element.id);

            const corners = element.type === 'wall'
                ? wallGeometry.get(element.id) ?? element.getGeometry()
                : element.getGeometry();

            if (!this.renderer.isGeometryVisible(corners)) {
                continue;
            }

            if (element.type === 'wall' && element.openings.length > 0) {
                for (const section of wallSections(element, corners)) {
                    this.renderer.drawElement(element, false, isSelected, section);
                }

                for (const opening of element.openings) {
                    if (opening.type === 'window') {
                        this.renderer.drawWindow(element, opening, isSelected);
                    } else {
                        this.renderer.drawDoor(element, opening, isSelected);
                    }
                }
            } else {
                this.renderer.drawElement(element, false, isSelected, corners);
            }
        }

        for (const element of this.engine.elements) {
            if (element.type !== 'wall') continue;

            const corners = wallGeometry.get(element.id) ?? element.getGeometry();

            if (this.renderer.isGeometryVisible(corners)) {
                this.renderer.drawWallFaceLengths(corners);
            }
        }
        
        this.renderer.drawWallCornerAngles(this.engine.elements.filter(element => element.type === 'wall'));

        // A full redraw replaces any temporary drawing preview.
        this.previewRenderer?.clear();
    }
}
