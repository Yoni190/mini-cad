import WallDrawingTool from './tools/WallDrawingTool';
import SelectionTool from './tools/SelectionTool';
import CanvasNavigation from './CanvasNavigation';
import WallTopology from '../geometry/WallTopology';
import Wall from '../models/Wall';
import { findBlueprintLineNear } from '../geometry/findBlueprintLine';
import GeometryService from '../geometry/GeometryService';

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager, selectionManager, view, wallInputs, wallPreviewRenderer) {
        this.canvas = canvas;
        this.engine = engine;
        this.view = view;
        this.wallInputs = wallInputs;
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
        this.measureDone = false;
        this.tracingImage = null;
        this.tracingImageData = null;
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
            if (
                this.activeTool === 'door' ||
                this.activeTool === 'smart-tracing' ||
                (this.activeTool === 'wall' && !this.wallTool.startPoint)
            ) {
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
            if (event.target !== this.canvas && (this.selectionTool.box || this.navigation.isPanning)) this.handleMouseMove(event);
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

    findOpeningPosition(point, width) {
        let closestWall = null;
        let closestProjection = null;

        for (const wall of this.engine.elements) {
            if (wall.type !== 'wall') continue;

            const projection = WallTopology.project(point, wall);
            const tolerance = wall.thickness + 20 / this.renderer.scale;

            if (
                projection.distance <= tolerance &&
                (!closestProjection || projection.distance < closestProjection.distance)
            ) {
                closestWall = wall;
                closestProjection = projection;
            }
        }

        if (!closestWall) return null;

        const dx = closestWall.end.x - closestWall.start.x;
        const dy = closestWall.end.y - closestWall.start.y;
        const cross = dx * (point.y - closestWall.start.y)
            - dy * (point.x - closestWall.start.x);

        return {
            wall: closestWall,
            offset: closestProjection.t * closestWall.getLength() - width / 2,
            swingSide: cross === 0 || Math.sign(cross) === closestWall.thicknessSide
                ? 1
                : -1,
        };
    }

    /**
     * Routes clicks to the active tool using world coordinates.
     *
     * Wall drawing uses two clicks: the first stores a start point,
     * and the second commits a wall. Selection uses unsnapped points.
     */
    handleClick(event) {
        if (this.isEditingLocked) return;
        if (this.activeTool === 'pan') return;
        if (this.selectionTool.consumeNextClick()) return;

        if (event.button !== 0) {
            return;
        }

        if (this.activeTool === 'smart-tracing') {
            if (this.wallInputs.getThickness(true) === null) {
                this.wallPreviewRenderer.clear();
                return;
            }

            const candidate = this.renderTracingPreview(event);

            if (!candidate) return;

            try {
                this.engine.addWall(
                    candidate.start,
                    candidate.end,
                    candidate.thickness,
                    candidate.thicknessSide
                );

                this.wallPreviewRenderer.clear();
            } catch (error) {
                alert(error.message);
            }

            return;
        }

        if (this.activeTool === 'calibrate') {
            const point = this.getMousePoint(event, false);
            const image = this.view.blueprint;
            const scale = this.view.blueprintScale ?? (image && Math.min(1000 / image.width, 600 / image.height) / 0.1);
            if (!image || point.x < 0 || point.y < 0 || point.x > image.width * scale || point.y > image.height * scale) {
                this.onCalibrationPoints?.(null, null, 'Select a point on the blueprint.');
                return;
            }
            if (!this.measureStart || this.measureDone) {
                this.measureStart = point;
                this.measureEnd = point;
                this.measureDone = false;
            } else {
                this.measureEnd = this.constrainCalibrationPoint(point);
                this.measureDone = true;
            }
            this.onCalibrationPoints?.(this.measureStart, this.measureDone ? this.measureEnd : null);
            this.renderMeasurement();
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

        if (this.activeTool === 'door' || this.activeTool === 'window') {
            const click = this.getMousePoint(event, false);
            const isWindow = this.activeTool === 'window';

            const width = Number(document.getElementById(
                isWindow ? 'windowWidth' : 'doorWidth'
            ).value);

            const height = Number(document.getElementById(
                isWindow ? 'windowHeight' : 'doorHeight'
            ).value);

            const position = this.findOpeningPosition(click, width);

            if (!position) {
                alert('Click closer to a wall.');
                return;
            }

            const { wall, offset, swingSide } = position;

            try {
                if (isWindow) {
                    const sillHeight = Number(
                        document.getElementById('windowSillHeight').value
                    );

                    this.engine.addWindow(
                        wall.id, offset, width, height, sillHeight
                    );
                } else {
                    this.engine.addDoor(wall.id, offset, width, height, swingSide);
                }

                this.view.render();
            } catch (error) {
                alert(error.message);
            }

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

        if (this.activeTool === 'wall') {
            this.wallTool.handleClick(point);
        }
    }

    renderDoorPreview(point) {
        const width = Number(document.getElementById('doorWidth').value);
        const height = Number(document.getElementById('doorHeight').value);
        const position = this.findOpeningPosition(point, width);

        this.wallPreviewRenderer.prepareFrame();

        if (!position) return;

        const { wall, offset, swingSide } = position;
        const opening = { offset, width, height, swingSide };

        try {
            new Wall({
                ...wall,
                openings: [...wall.openings, opening],
            });
        } catch {
            return;
        }

        this.wallPreviewRenderer.previewRenderer.drawDoor(wall, opening, true);
    }

    renderTracingPreview(event) {
        const image = this.view.blueprint;
        const scale = this.view.blueprintScale;

        if (!image || !Number.isFinite(scale) || scale <= 0) {
            this.wallPreviewRenderer.clear();
            return;
        }

        if (this.tracingImage !== image) {
            const imageCanvas = document.createElement('canvas');
            imageCanvas.width = image.width;
            imageCanvas.height = image.height;

            const context = imageCanvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0);

            this.tracingImageData = context.getImageData(
                0, 0, image.width, image.height
            );
            this.tracingImage = image;
        }

        const worldPoint = this.getMousePoint(event, false);
        const imagePoint = {
            x: worldPoint.x / scale,
            y: worldPoint.y / scale,
        };

        const line = findBlueprintLineNear(this.tracingImageData, imagePoint);

        this.wallPreviewRenderer.prepareFrame();

        if (!line) return;

        const detectedStart = {
            x: (line.start.x + 0.5) * scale,
            y: (line.start.y + 0.5) * scale,
        };

        const detectedEnd = {
            x: (line.end.x + 0.5) * scale,
            y: (line.end.y + 0.5) * scale,
        };

        const tolerance = 20 / this.renderer.scale;

        const start = this.snapManager.snap(
            detectedStart,
            this.engine.findWallsNear(detectedStart, tolerance),
            tolerance
        );

        const end = this.snapManager.snap(
            detectedEnd,
            this.engine.findWallsNear(detectedEnd, tolerance),
            tolerance
        );

        if (start.x === end.x && start.y === end.y) return;

        const thickness = this.wallInputs.getThickness();

        if (thickness === null) return;
        const automaticSide = GeometryService.resolveWallThicknessSide(
            start,
            end,
            this.engine.elements
        );

        const direction = document.getElementById('tracingThicknessSide').value;
        const thicknessSide = direction === 'opposite'
            ? -automaticSide
            : automaticSide;

        const previewWall = new Wall({
            start,
            end,
            thickness,
            thicknessSide,
        });

        const previewRenderer = this.wallPreviewRenderer.previewRenderer;
        previewRenderer.drawElement(previewWall, true);
        previewRenderer.drawWallLength(previewWall);

        return previewWall;
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

        if (this.activeTool === 'smart-tracing') {
            this.renderTracingPreview(event);
            return;
        }

        if (this.activeTool === 'door') {
            this.renderDoorPreview(this.getMousePoint(event, false));
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

        if (this.activeTool === 'measure' || this.activeTool === 'calibrate') {
            if (this.measureStart && !this.measureDone) {
                const point = this.getMousePoint(event, this.activeTool === 'measure');
                this.measureEnd = this.activeTool === 'calibrate'
                    ? this.constrainCalibrationPoint(point) : point;
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
        if (event.button === 1 || (event.button === 0 && this.activeTool === 'pan')) {
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

        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (!isTypingInField && modifier && !event.altKey) {
            const undo = key === 'z' && !event.shiftKey;
            const redo = (key === 'z' && event.shiftKey) ||
                (key === 'y' && !event.shiftKey);

            if (undo || redo) {
                event.preventDefault();
                this.cancelInteraction({ clearSelection: true });

                if (undo) this.engine.undo();
                else this.engine.redo();

                this.view.render();
                return;
            }
        }

        if (
            !isTypingInField && (event.ctrlKey || event.metaKey) &&
            !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a' &&
            document.getElementById('twoContainer').style.display !== 'none'
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
            document.getElementById('twoContainer').style.display !== 'none'
        ) {
            event.preventDefault();
            this.toggleOrtho();
            return;
        }

        const isDrawingWall =
            this.activeTool === 'wall' &&
            this.wallTool.startPoint !== null &&
            document.getElementById('twoContainer').style.display !== 'none';

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
            document.getElementById('twoContainer').style.display !== 'none'
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
        const tolerance = 20 / this.renderer.scale;

        return this.snapManager.snap(
            rawPoint,
            this.engine.findWallsNear(rawPoint, tolerance),
            tolerance,
            null
        );
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
        this.onCalibrationPoints?.(null, null);
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
                document.getElementById('twoContainer').style.display === 'none'
            ) return;

            if (this.activeTool === 'measure' || this.activeTool === 'calibrate') {
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
                document.getElementById('twoContainer').style.display !== 'none'
            ) {
                this.renderWallPreview();
            }

            if (
                !this.isEditingLocked &&
                (this.activeTool === 'measure' || this.activeTool === 'calibrate') &&
                document.getElementById('twoContainer').style.display !== 'none'
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

    updateSelectedColumnDimensions(width, depth, height) {
        if (this.isEditingLocked) return;
        const selected = this.selectionManager.selectedElement;
        if (!selected || selected.type !== 'column') {
            throw new Error('Please select a column first.');
        }
        if (this.activeTool !== 'select') return;
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(depth) || depth <= 0 || !Number.isFinite(height) || height <= 0) {
            throw new Error('Width, depth and height must be positive numbers.');
        }
        this.engine.updateColumnDimensions(selected.id, width, depth, height);
    }

    updateSelectedWallHeight(height) {
        if (this.isEditingLocked || this.activeTool !== 'select') return;
        const selected = this.selectionManager.selectedElement;
        if (selected?.type !== 'wall') throw new Error('Please select a wall first.');
        this.engine.updateWallHeight(selected.id, height);
    }

    removeSelectedWallDoor(index) {
        if (this.isEditingLocked || this.activeTool !== 'select') return;

        const wall = this.selectionManager.selectedElement;

        if (!wall || wall.type !== 'wall') {
            throw new Error('Please select a wall first.');
        }

        this.engine.removeDoor(wall.id, index);
        this.view.render(this.selectionManager.selectedIds);
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

    constrainCalibrationPoint(point) {
        const start = this.measureStart;
        return Math.abs(point.x - start.x) >= Math.abs(point.y - start.y)
            ? { x: point.x, y: start.y }
            : { x: start.x, y: point.y };
    }
}
