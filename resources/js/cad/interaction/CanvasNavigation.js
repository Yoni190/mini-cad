/** Owns 2D pan/zoom state */
export default class CanvasNavigation {
    constructor({ canvas, renderer, requestRender }) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.requestRender = requestRender;
        this.isPanning = false;
        this.lastPanPoint = null;
    }

    startPan(event) {
        event.preventDefault();
        this.isPanning = true;
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
    }

    updatePan(event) {
        if (!this.isPanning) return;
        this.renderer.offsetX += event.clientX - this.lastPanPoint.x;
        this.renderer.offsetY += event.clientY - this.lastPanPoint.y;
        this.lastPanPoint = { x: event.clientX, y: event.clientY };
        this.requestRender();
    }

    stopPan() {
        this.isPanning = false;
        this.lastPanPoint = null;
    }

    /** Keep the world point under the cursor fixed when changing scale. */
    zoom(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldPoint = this.renderer.screenToWorld(mouseX, mouseY);
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.min(2, Math.max(0.01, this.renderer.scale * zoomFactor));
        if (newScale === this.renderer.scale) return;

        this.renderer.scale = newScale;
        this.renderer.offsetX = mouseX - worldPoint.x * newScale;
        this.renderer.offsetY = mouseY - worldPoint.y * newScale;
        this.requestRender();
    }
}
