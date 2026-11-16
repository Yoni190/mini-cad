import WallDrawingTool from './tools/WallDrawingTool';
import SelectionTool from './tools/SelectionTool';
import CanvasNavigation from './CanvasNavigation';

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager, selectionManager, view, wallInputs, wallPreviewRenderer) {
        this.canvas = canvas;
        this.engine = engine;
        this.view = view;
        this.wallPreviewRenderer = wallPreviewRenderer;
        this.renderer = renderer;
        this.snapManager = snapManager;
        this.activeTool = 'wall';
        this.selectionManager = selectionManager;
        this.navigation = new CanvasNavigation({
            canvas,
            renderer,
            requestRender: () => this.scheduleCanvasRender(),
        });
        this.selectionTool = new SelectionTool({
            engine, selectionManager,
            getScale: () => this.renderer.scale,
            requestRender: () => this.scheduleCanvasRender(),
            renderSelection: selectedIds => this.view.render(selectedIds),
            renderBox: (start, end) => this.wallPreviewRenderer.renderSelectionBox(start, end),
            clearBox: () => this.wallPreviewRenderer.clear(),
        });
        this.isEditingLocked = false;
        this.pendingRenderFrame = null;
        this.pendingPreviewFrame = null;
        this.measureStart = null;
        this.measureEnd = null;
        this.measureDone = false;
        this.wallTool = new WallDrawingTool({
            engine, snapManager, inputs: wallInputs,
            getScale: () => this.renderer.scale,
            showMessage: message => alert(message),
            preview: {
                clear: () => this.wallPreviewRenderer.clear(),
                render: () => this.renderWallPreview(),
                request: () => this.scheduleWallPreview(),
                showStartHints: point => this.wallPreviewRenderer.renderStartHints(point, this.engine.elements),
            },
        });
    }

    init() {
        this.canvas.addEventListener('click', (event) => {
            this.handleClick(event);
        });

        this.canvas.addEventListener('mousemove', (event) => {
            this.handleMouseMove(event);
        });

        this.canvas.addEventListener('mousedown', (event) => {
            this.handleMouseDown(event);
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.activeTool === 'wall' && !this.wallTool.startPoint) {
                this.wallPreviewRenderer.clear();
            }
        });

        this.canvas.addEventListener(
            'wheel',
            (event) => this.handleWheel(event),
            { passive: false }
        );

        this.canvas.addEventListener('auxclick', (event) => {
            if (event.button === 1) {
                event.preventDefault();
            }
        });

        window.addEventListener('mousemove', event => {
            if (event.target !== this.canvas && this.selectionTool.box) this.handleMouseMove(event);
        });
        window.addEventListener('mouseup', event => {
            this.handleMouseUp(event);
        });

        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        document.getElementById('drawingTool')
            .addEventListener('change', (event) => {
                this.activeTool = event.target.value;

                this.cancelInteraction({ clearSelection: true });

                this.view.render();
            });

        document.getElementById('toggleOrtho')
            .addEventListener('click', () => this.toggleOrtho());
    }

    /**
     * Routes clicks to the active tool using world coordinates.
     *
     * Wall drawing uses two clicks: the first stores a start point,
     * and the second commits a wall. Selection uses unsnapped points.
     */
    handleClick(event) {
        if (this.isEditingLocked) return;
        if (this.selectionTool.consumeNextClick()) return;

        if (event.button !== 0) {
            return;
        }
        
        let point = this.getMousePoint(
            event,
            this.activeTool !== 'select'
        );

        if (this.activeTool === 'select') {
            this.selectionTool.handleClick(point);
            return;
        }

        if (this.activeTool === 'measure') {
            if (!this.measureStart || this.measureDone) {
                this.measureStart = point;
                this.measureEnd = point;
                this.measureDone = false;
            } else {
                this.measureEnd = point;
                this.measureDone = true;
            }

            this.renderMeasurement();
            return;
        }

        if(this.activeTool === 'column') {
            try {
                this.engine.addColumn(point);
            } catch (error) {
                alert(error.message);
            }
            return;
        }

        this.wallTool.handleClick(point);
    }

    /**
     * Updates panning, column dragging, or a temporary wall preview.
     *
     * Column dragging preserves the original mouse-to-column offset
     * so the column does not jump to the cursor when movement begins.
     */
    handleMouseMove(event) {
        if (this.isEditingLocked) return;
        // Navigation takes priority over dragging and drafting previews.
        if (this.navigation.isPanning) {
            this.navigation.updatePan(event);
            return;
        }

        if (this.activeTool === 'select' && this.selectionTool.box) {
            this.selectionTool.updateBox(this.getMousePoint(event, false));
            return;
        }

        if (this.selectionTool.isDragging) {
            this.selectionTool.updateDrag(this.getMousePoint(event, false));
            return;
        }

        if (this.activeTool === 'measure') {
            if (this.measureStart && !this.measureDone) {
                this.measureEnd = this.getMousePoint(event);
                this.scheduleWallPreview();
            }
            return;
        }

        if (this.activeTool === 'wall') {
            this.wallTool.handleMouseMove(this.getMousePoint(event));
        }
    }

    handleMouseDown(event) {
        if (this.isEditingLocked) return;
        if (event.button === 1) {
            this.navigation.startPan(event);
            return;
        }

        if (this.activeTool !== 'select' || event.button !== 0) {
            return;
        }

        const point = this.getMousePoint(event, false);
        if (event.detail === 2) this.selectionTool.startBox(point);
        else this.selectionTool.startDrag(point);
    }

    handleMouseUp(event) {
        if (this.isEditingLocked) return;
        if (this.selectionTool.box && event?.button === 0) {
            this.selectionTool.finishBox(this.getMousePoint(event, false), event.target === this.canvas);
        } else if (!this.selectionTool.box) {
            this.selectionTool.endDrag();
        }
        this.navigation.stopPan();
    }

    handleKeyDown(event) {
        if (this.isEditingLocked) return;
        const isTypingInField =
            event.target instanceof HTMLElement &&
            (
                event.target.matches('input, textarea, select') ||
                event.target.isContentEditable
            );

        if (
            !isTypingInField && (event.ctrlKey || event.metaKey) &&
            !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a' &&
            document.getElementById('threeContainer').style.display === 'none'
        ) {
            event.preventDefault();
            if (this.activeTool !== 'select') {
                const tool = document.getElementById('drawingTool');
                tool.value = 'select';
                tool.dispatchEvent(new Event('change', { bubbles: true }));
            }
            this.cancelInteraction();
            this.selectionManager.setSelection([...this.engine.elements]);
            this.view.render(this.selectionManager.selectedIds);
            return;
        }

        if (
            !isTypingInField &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !event.repeat &&
            event.key.toLowerCase() === 'o' &&
            this.activeTool === 'wall' &&
            document.getElementById('threeContainer').style.display === 'none'
        ) {
            event.preventDefault();
            this.toggleOrtho();
            return;
        }

        const isDrawingWall =
            this.activeTool === 'wall' &&
            this.wallTool.startPoint !== null &&
            document.getElementById('threeContainer').style.display === 'none';

        if (
            isDrawingWall &&
            !isTypingInField &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            if (this.wallTool.handleKeyDown(event)) return;
        }
        
        if (event.key === 'Escape') {
            this.cancelInteraction({ clearSelection: true });

            this.view.render();
        }

        if(
            this.activeTool === 'select' &&
            (event.key === 'Delete' || event.key === 'Backspace') &&
            document.getElementById('threeContainer').style.display === 'none'
        ) {
            const tag = event.target?.tagName;

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
                return;
            }

            if (!this.selectionTool.hasSelection) return;
            event.preventDefault();
            this.selectionTool.deleteSelected();
        }
    }

    handleWheel(event) {
        if (this.isEditingLocked) return;
        this.navigation.zoom(event);
    }

    /**
     * Converts browser mouse coordinates to canvas-local pixels,
     * then to millimeters, optionally snapping to a wall endpoint.
     */
    getMousePoint(event, applySnap = true) {
        const rect = this.canvas.getBoundingClientRect();

        const rawPoint = this.renderer.screenToWorld(
            event.clientX - rect.left,
            event.clientY - rect.top
        );

        if (!applySnap) return rawPoint;

        if (this.activeTool === 'wall') return this.wallTool.getSnappedPoint(rawPoint);
        return this.snapManager.snap(rawPoint, this.engine.elements, 20 / this.renderer.scale, null);
    }

    cancelWallDrawing() {
        this.wallTool.cancel();
    }

    /** Cancel transient gestures without rolling back committed model changes. */
    cancelInteraction({ clearSelection = false } = {}) {
        this.cancelWallDrawing();
        this.selectionTool.cancel({ clearSelection });
        this.navigation.stopPan();
        this.measureStart = null;
        this.measureEnd = null;
        this.measureDone = false;
        this.wallPreviewRenderer.clear();
    }

    /**
     * Locks editor interactions during project save or load operations.
     *
     * Entering the locked state cancels unfinished previews and gestures;
     * already committed elements remain in the drawing.
     */
    setEditingLocked(locked) {
        this.isEditingLocked = locked;

        if (locked) {
            this.cancelInteraction();

            this.view.render(this.selectionManager.selectedIds);
        }
    }

    renderWallPreview() {
        this.wallPreviewRenderer.render(this.wallTool.getPreview(), this.engine.elements);
    }

    toggleOrtho() {
        if (this.isEditingLocked) return;
        this.wallTool.toggleOrtho();
        if (this.activeTool === 'wall' && this.wallTool.startPoint) this.renderWallPreview();
    }

    scheduleWallPreview() {
        if (
            this.pendingPreviewFrame !== null ||
            this.pendingRenderFrame !== null
        ) {
            return;
        }

        this.pendingPreviewFrame = requestAnimationFrame(() => {
            this.pendingPreviewFrame = null;

            if (
                this.isEditingLocked ||
                document.getElementById('threeContainer').style.display !== 'none'
            ) return;

            if (this.activeTool === 'measure') {
                this.renderMeasurement();
                return;
            }

            if (this.activeTool === 'wall' && this.wallTool.hasPreview) {
                this.renderWallPreview();
            }
        });
    }

    scheduleCanvasRender() {
        if (this.pendingPreviewFrame !== null) {
            cancelAnimationFrame(this.pendingPreviewFrame);
            this.pendingPreviewFrame = null;
        }
        
        if (this.pendingRenderFrame !== null) return;

        this.pendingRenderFrame = requestAnimationFrame(() => {
            this.pendingRenderFrame = null;

            this.view.render(
                this.selectionManager.selectedIds
            );

            // A full redraw clears the preview overlay. Restore an active
            // preview using the current zoom and pan.
            if (
                !this.isEditingLocked &&
                this.activeTool === 'wall' &&
                this.wallTool.hasPreview &&
                document.getElementById('threeContainer').style.display === 'none'
            ) {
                this.renderWallPreview();
            }

            if (
                !this.isEditingLocked &&
                this.activeTool === 'measure' &&
                document.getElementById('threeContainer').style.display === 'none'
            ) {
                this.renderMeasurement();
            }
        });
    }


    /** Property actions accept values; UI bindings display any validation errors. */
    applyWallLength(length) {
        if (this.isEditingLocked) return;
        if (!Number.isFinite(length) || length <= 0) {
            throw new Error('Please enter a positive wall length.');
        }
        this.wallTool.createWallWithLength(length);
    }

    updateSelectedColumnDimensions(width, depth) {
        if (this.isEditingLocked) return;
        const selected = this.selectionManager.selectedElement;
        if (!selected || selected.type !== 'column') {
            throw new Error('Please select a column first.');
        }
        if (this.activeTool !== 'select') return;
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(depth) || depth <= 0) {
            throw new Error('Width and depth must be positive numbers.');
        }
        this.engine.updateColumnDimensions(selected.id, width, depth);
    }

    updateSelectedWallHeight(height) {
        if (this.isEditingLocked || this.activeTool !== 'select') return;
        const selected = this.selectionManager.selectedElement;
        if (selected?.type !== 'wall') throw new Error('Please select a wall first.');
        this.engine.updateWallHeight(selected.id, height);
    }

    updateSelectedWallThickness(thickness) {
        if (this.isEditingLocked || this.activeTool !== 'select') return;
        const selected = this.selectionManager.selectedElement;
        if (selected?.type !== 'wall') {
            throw new Error('Please select a wall first.');
        }
        this.engine.updateWallThickness(selected.id, thickness);
    }

    refreshWallPreview() {
        if (this.isEditingLocked) return;
        if (this.activeTool === 'wall' && this.wallTool.hasPreview) {
            this.renderWallPreview();
        }
    }

    renderMeasurement() {
        this.wallPreviewRenderer.renderMeasurement(
            this.measureStart,
            this.measureEnd
        );
    }
}
