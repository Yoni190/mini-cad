import WallDrawingTool from './tools/WallDrawingTool';
import CanvasNavigation from './CanvasNavigation';

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager, selectionManager, view, wallInputs) {
        this.canvas = canvas;
        this.engine = engine;
        this.view = view;
        this.renderer = renderer;
        this.snapManager = snapManager;
        this.activeTool = 'wall';
        this.selectionManager = selectionManager;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.navigation = new CanvasNavigation({
            canvas,
            renderer,
            requestRender: () => this.scheduleCanvasRender(),
        });
        this.isEditingLocked = false;
        this.wallDrag = null;
        this.suppressNextClick = false;
        this.pendingRenderFrame = null;
        this.pendingPreviewFrame = null;
        this.wallTool = new WallDrawingTool({
            engine, snapManager, inputs: wallInputs,
            getScale: () => this.renderer.scale,
            showMessage: message => alert(message),
            preview: {
                clear: () => this.previewRenderer.clear(),
                render: () => this.renderWallPreview(),
                request: () => this.scheduleWallPreview(),
                showStartHints: point => this.renderWallStartHints(point),
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
                this.previewRenderer.clear();
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

        window.addEventListener('mouseup', () => {
            this.handleMouseUp();
        });

        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });

        document.getElementById('drawingTool')
            .addEventListener('change', (event) => {
                this.activeTool = event.target.value;

                this.cancelWallDrawing();
                this.isDragging = false;
                this.selectionManager.clear();

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
        if (this.suppressNextClick) {
            this.suppressNextClick = false;
            return;
        }

        if (event.button !== 0) {
            return;
        }
        
        let point = this.getMousePoint(
            event,
            this.activeTool !== 'select'
        );

        if(this.activeTool === 'select') {
            const selected = this.selectionManager.select(
                point,
                this.engine.elements,
                this.engine.getWallDisplayGeometry()
            );

            this.view.render(selected?.id ?? null);
            return;
        }

        if(this.activeTool === 'column') {
            this.engine.addColumn(point);
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

        if (this.wallDrag) {
            const drag = this.wallDrag;
            const point = this.getMousePoint(event, false);

            const mouseDx = point.x - drag.mouseStart.x;
            const mouseDy = point.y - drag.mouseStart.y;

            // Project the mouse movement onto the wall's perpendicular direction.
            const distance =
                mouseDx * drag.normal.x +
                mouseDy * drag.normal.y;

            const offset = {
                x: drag.normal.x * distance,
                y: drag.normal.y * distance,
            };

            const newStart = {
                x: drag.start.x + offset.x,
                y: drag.start.y + offset.y,
            };

            const newEnd = {
                x: drag.end.x + offset.x,
                y: drag.end.y + offset.y,
            };

            const changes = new Map([
                [drag.wall.id, { id: drag.wall.id, start: newStart, end: newEnd }],
            ]);

            for (const connection of drag.connections) {
                const wall = connection.wall;
                if (!changes.has(wall.id)) {
                    changes.set(wall.id, { id: wall.id, start: wall.start, end: wall.end });
                }
                changes.get(wall.id)[connection.key] =
                    connection.junction === 'start' ? newStart : newEnd;
            }

            if (!this.engine.updateWallEndpoints([...changes.values()])) return;

            if (Math.hypot(mouseDx, mouseDy) * this.renderer.scale > 2) {
                drag.moved = true;
            }

            this.scheduleCanvasRender();
            return;
        }

        // Handle column dragging
        if (this.isDragging) {
            const point = this.getMousePoint(event, false);
            const column = this.selectionManager.selectedElement;

            if (!column) {
                this.isDragging = false;
                return;
            }

            const moved = this.engine.moveColumn(column.id, {
                x: point.x - this.dragOffset.x,
                y: point.y - this.dragOffset.y
            });

            if (moved) this.scheduleCanvasRender();
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

        const selected = this.selectionManager.selectedElement;

        if (selected?.type === 'wall') {
            const point = this.getMousePoint(event, false);
            const corners = this.engine.getWallDisplayGeometry().get(selected.id)
                ?? selected.getGeometry();

            if (!this.selectionManager.isPointInsidePolygon(point, corners)) {
                return;
            }

            const start = { ...selected.start };
            const end = { ...selected.end };
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy);

            if (length === 0) return;

            // Record endpoints that exactly share a junction with this wall.
            const connections = [];

            for (const wall of this.engine.elements) {
                if (wall.type !== 'wall' || wall.id === selected.id) continue;

                for (const key of ['start', 'end']) {
                    const endpoint = wall[key];

                    if (endpoint.x === start.x && endpoint.y === start.y) {
                        connections.push({ wall, key, junction: 'start' });
                    } else if (endpoint.x === end.x && endpoint.y === end.y) {
                        connections.push({ wall, key, junction: 'end' });
                    }
                }
            }

            this.wallDrag = {
                wall: selected,
                mouseStart: point,
                start,
                end,
                normal: { x: -dy / length, y: dx / length },
                connections,
                moved: false,
            };

            return;
        }
        const column = this.selectionManager.selectedElement;

        if (!column || column.type !== 'column') {
            return;
        }

        const point = this.getMousePoint(event, false);

        if (!this.selectionManager.isPointInsideColumn(point, column)) {
            return;
        }

        this.dragOffset = {
            x: point.x - column.position.x,
            y: point.y - column.position.y
        };

        this.isDragging = true;
    }

    handleMouseUp() {
        if (this.isEditingLocked) return;
        if (this.wallDrag) {
            this.suppressNextClick = this.wallDrag.moved;
            this.wallDrag = null;
        }
        this.isDragging = false;
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
            this.cancelWallDrawing();
            this.isDragging = false;
            this.selectionManager.clear();

            this.view.render();
        }

        if(
            this.activeTool === 'select' &&
            (event.key === 'Delete' || event.key === 'Backspace')
        ) {
            const tag = event.target?.tagName;

            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
                return;
            }

            const selected = this.selectionManager.selectedElement;

            if (!selected) {
                return;
            }

            event.preventDefault();

            this.engine.removeElement(selected.id);
            this.selectionManager.clear();
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

    /**
     * Locks editor interactions during project save or load operations.
     *
     * Entering the locked state cancels unfinished previews and gestures;
     * already committed elements remain in the drawing.
     */
    setEditingLocked(locked) {
        this.isEditingLocked = locked;

        if (locked) {
            // Cancel unfinished wall drawing
            this.cancelWallDrawing();

            // Stop any active dragging or panning
            this.isDragging = false;
            this.navigation.stopPan();
            this.wallDrag = null;

            // Clear any drawing preview
            this.view.render();
        }
    }

    renderWallStartHints(point) {
        const previewRenderer = this.previewRenderer;

        // Use the same view as the main canvas.
        previewRenderer.scale = this.renderer.scale;
        previewRenderer.offsetX = this.renderer.offsetX;
        previewRenderer.offsetY = this.renderer.offsetY;
        previewRenderer.clear();

        // Show alignment hints for existing endpoints and midpoints.
        previewRenderer.drawWallGuides(
            { start: null, end: point },
            this.engine.elements
        );

        // getMousePoint already snaps to nearby wall endpoints.
        const isAtEndpoint = this.snapManager.isOnWall(
            point,
            this.engine.elements
        );

        if (isAtEndpoint) {
            previewRenderer.drawSnapMarker(point);
        }
    }

    renderWallPreview() {
        const previewRenderer = this.previewRenderer;

        // Match the main canvas's current zoom and pan.
        previewRenderer.scale = this.renderer.scale;
        previewRenderer.offsetX = this.renderer.offsetX;
        previewRenderer.offsetY = this.renderer.offsetY;

        // Erase the previous temporary wall and guides.
        previewRenderer.clear();

        const preview = this.wallTool.getPreview();
        if (!preview) return;

        previewRenderer.drawElement(preview, true);
        previewRenderer.drawWallLength(preview);
        previewRenderer.drawWallGuides(preview, this.engine.elements);

        const isAtEndpoint = this.snapManager.isOnWall(
            preview.end,
            this.engine.elements
        );

        if (isAtEndpoint) {
            previewRenderer.drawSnapMarker(preview.end);
        }
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

            // The drawing operation may have ended while the frame was pending.
            if (
                this.isEditingLocked ||
                this.activeTool !== 'wall' ||
                !this.wallTool.hasPreview ||
                document.getElementById('threeContainer').style.display !== 'none'
            ) {
                return;
            }

            this.renderWallPreview();
        });
    }

    scheduleCanvasRender() {
        if (this.pendingPreviewFrame !== null) {
            cancelAnimationFrame(this.pendingPreviewFrame);
            this.pendingPreviewFrame = null;
        }
        
        // A redraw is already scheduled for the next frame.
        if (this.pendingRenderFrame !== null) return;

        this.pendingRenderFrame = requestAnimationFrame(() => {
            this.pendingRenderFrame = null;

            // Use the current selection and current element positions.
            this.view.render(
                this.selectionManager.selectedElement?.id ?? null
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
}
