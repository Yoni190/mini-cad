import GeometryService from "../geometry/GeometryService";
import Wall from "../models/Wall";
import WallTopology from '../geometry/WallTopology';
import CanvasNavigation from './CanvasNavigation';

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager, selectionManager, view) {
        this.canvas = canvas;
        this.engine = engine;
        this.view = view;
        this.renderer = renderer;
        this.snapManager = snapManager;
        this.activeTool = 'wall';
        this.startPoint = null;
        this.directionPoint = null;
        this.alignmentHold = { x: null, y: null };
        this.selectionManager = selectionManager;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.navigation = new CanvasNavigation({
            canvas,
            renderer,
            requestRender: () => this.scheduleCanvasRender(),
        });
        this.isEditingLocked = false;
        this.orthoEnabled = false;
        this.wallChainStart = null;
        this.wallChainCount = 0;
        this.wallDrag = null;
        this.suppressNextClick = false;
        this.pendingRenderFrame = null;
        this.pendingPreviewFrame = null;
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
            if (this.activeTool === 'wall' && !this.startPoint) {
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

        if (this.startPoint === null) {
            this.alignmentHold = { x: null, y: null };
            this.previewRenderer.clear();
            this.startPoint = point;
            this.wallChainStart = { ...point };
            this.wallChainCount = 0;
            this.directionPoint = null;

            // Start each wall without a leftover length from the previous one.
            document.getElementById('wallLength').value = '';
        } else {
            // The second click determines the direction.
            this.directionPoint = point;

            const length = Number(document.getElementById('wallLength').value);

            if (Number.isFinite(length) && length > 0) {
                this.createWallWithLength(length);
            } else {
                this.commitWall(this.constrainWallPoint(point));
            }
        }
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

        // Wall preview and hints before the first click.
        if (this.activeTool === 'wall') {
            if (this.startPoint) {
                this.directionPoint = this.getMousePoint(event);

                // Mouse movement takes control of the wall length again.
                document.getElementById('wallLength').value = '';
                this.scheduleWallPreview();
            } else {
                this.renderWallStartHints(this.getMousePoint(event));
            }
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
            this.startPoint !== null &&
            document.getElementById('threeContainer').style.display === 'none';

        if (
            isDrawingWall &&
            !isTypingInField &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            const input = document.getElementById('wallLength');

            if (/^[0-9]$/.test(event.key)) {
                event.preventDefault();
                input.value += event.key;
                this.renderWallPreview();
                return;
            }

            if (event.key === '.' && !input.value.includes('.')) {
                event.preventDefault();
                // A number input cannot retain a trailing decimal point reliably,
                // so type whole millimeters with this shortcut.
                return;
            }

            if (event.key === 'Backspace') {
                event.preventDefault();
                input.value = input.value.slice(0, -1);
                this.renderWallPreview();
                return;
            }

            if (event.key === 'Enter') {
                event.preventDefault();

                const length = Number(input.value);
                if (Number.isFinite(length) && length > 0) {
                    this.createWallWithLength(length);
                }

                return;
            }
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

        const start = this.startPoint;
        const drawingWall = this.activeTool === 'wall' && start;

        // Apply guides and Ortho before choosing a wall connection.
        const point = drawingWall
            ? this.constrainWallPoint(this.alignWallPoint(rawPoint))
            : rawPoint;

        let constraint = null;

        if (drawingWall && this.orthoEnabled) {
            const axis = point.x === start.x ? 'x' : 'y';

            constraint = {
                axis,
                value: start[axis]
            };
        }

        return this.snapManager.snap(
            point,
            this.engine.elements,
            20 / this.renderer.scale,
            constraint
        );
    }

    /**
     * Commits a wall with the requested length in millimeters.
     *
     * The last preview direction determines its orientation. The
     * calculated endpoint is not snapped again, preserving exact length.
     */
    createWallWithLength(length) {
        const direction = this.directionPoint
            ? this.constrainWallPoint(this.directionPoint)
            : null;

        if(!this.startPoint || !direction) {
            alert('Click a starting point and move the mouse to choose a direction.');
            return;
        }
        if(this.startPoint.x === direction.x &&
            this.startPoint.y === direction.y
        ) {
            alert('Move the mouse to choose a wall direction first.');
            return;
        }

        const newEndpoint = GeometryService.getEndPoint(
            this.startPoint,
            direction,
            length
        );

        this.commitWall(newEndpoint);
    }

    /** Clears the unfinished wall and its chain without changing saved elements. */
    cancelWallDrawing() {
        this.startPoint = null;
        this.directionPoint = null;
        this.wallChainStart = null;
        this.wallChainCount = 0;
        this.alignmentHold = { x: null, y: null };
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

        const start = this.startPoint;
        const direction = this.directionPoint
            ? this.constrainWallPoint(this.directionPoint)
            : null;

        if (
            !start ||
            !direction ||
            (start.x === direction.x && start.y === direction.y)
        ) {
            return;
        }

        const length = Number(document.getElementById('wallLength').value);

        const end = Number.isFinite(length) && length > 0
            ? GeometryService.getEndPoint(start, direction, length)
            : direction;

        const thicknessInput = document.getElementById('newWallThickness');
        const thickness = Number(thicknessInput.value);
        if (!Number.isFinite(thickness) || thickness <= 0 || !thicknessInput.checkValidity()) return;

        const thicknessSide = GeometryService.resolveWallThicknessSide(
            start,
            end,
            this.engine.elements
        );

        const preview = new Wall({
            start,
            end,
            thickness,
            thicknessSide
        });

        previewRenderer.drawElement(preview, true);
        previewRenderer.drawWallLength(preview);
        previewRenderer.drawWallGuides(preview, this.engine.elements);

        const isAtEndpoint = this.snapManager.isOnWall(
            end,
            this.engine.elements
        );

        if (isAtEndpoint) {
            previewRenderer.drawSnapMarker(end);
        }
    }

    alignWallPoint(point) {
        const start = this.startPoint;

        if (!start) return point;

        const threshold = 8 / this.renderer.scale;
        const holdDuration = 250; // milliseconds
        const now = performance.now();

        // The guides use wall endpoints and midpoints as references.
        const references = [start];

        for (const element of this.engine.elements) {
            if (element.type !== 'wall') continue;

            references.push(
                element.start,
                element.end,
                {
                    x: (element.start.x + element.end.x) / 2,
                    y: (element.start.y + element.end.y) / 2,
                }
            );
        }

        const aligned = { ...point };

        for (const axis of ['x', 'y']) {
            const hold = this.alignmentHold[axis];

            if (hold && now < hold.until) {
                aligned[axis] = hold.value;
                continue;
            }

            // After the pause, release the coordinate once the pointer
            // moves outside the guide's threshold.
            if (hold) {
                if (Math.abs(point[axis] - hold.value) <= threshold) {
                    aligned[axis] = hold.value;
                    continue;
                }

                this.alignmentHold[axis] = null;
            }

            let nearest = null;

            for (const reference of references) {
                const distance = Math.abs(point[axis] - reference[axis]);

                if (
                    distance <= threshold &&
                    (!nearest || distance < nearest.distance)
                ) {
                    nearest = { value: reference[axis], distance };
                }
            }

            if (nearest) {
                aligned[axis] = nearest.value;
                this.alignmentHold[axis] = {
                    value: nearest.value,
                    until: now + holdDuration,
                };
            }
        }

        return aligned;
    }

    constrainWallPoint(point) {
        const start = this.startPoint;

        if (!this.orthoEnabled || !start) {
            return point;
        }

        const dx = point.x - start.x;
        const dy = point.y - start.y;

        if (Math.abs(dx) >= Math.abs(dy)) {
            return { x: point.x, y: start.y };
        }

        return { x: start.x, y: point.y };
    }

    toggleOrtho() {
        if (this.isEditingLocked) return;

        this.orthoEnabled = !this.orthoEnabled;

        const button = document.getElementById('toggleOrtho');
        button.setAttribute('aria-pressed', String(this.orthoEnabled));
        button.textContent = this.orthoEnabled ? 'Ortho: On' : 'Ortho: Off';

        if (this.activeTool === 'wall' && this.startPoint) {
            this.renderWallPreview();
        }
    }

    commitWall(end) {
        const start = this.startPoint;

        if (!start || !end) return;

        // Treat tiny floating-point differences as the same point.
        const samePoint = (a, b) =>
            Math.hypot(a.x - b.x, a.y - b.y) < 0.000001;

        if (samePoint(start, end)) return;

        const closesChain =
            this.wallChainStart && samePoint(end, this.wallChainStart);

        // A closed chain needs at least three walls.
        if (closesChain && this.wallChainCount < 2) {
            alert('A room needs at least three walls.');
            return;
        }

        // Use the exact original coordinates when closing the chain.
        const finalEnd = closesChain
            ? { ...this.wallChainStart }
            : { ...end };

        const thicknessInput = document.getElementById('newWallThickness');
        const thickness = Number(thicknessInput.value);
        if (!Number.isFinite(thickness) || thickness <= 0 || !thicknessInput.checkValidity()) {
            thicknessInput.reportValidity();
            thicknessInput.focus();
            return;
        }

        // An existing path between the endpoints also completes a room,
        // even when the chain began on an existing wall.
        let closesExistingPath;

        try {
            closesExistingPath = this.hasWallPath(
                start,
                finalEnd,
                samePoint
            );

            this.engine.addWall(start, finalEnd, thickness);
        } catch (error) {
            alert(error.message);
            return;
        }
        this.wallChainCount++;

        document.getElementById('wallLength').value = '';
        this.alignmentHold = { x: null, y: null };
        this.directionPoint = null;

        if (closesChain || closesExistingPath) {
            // The new wall completed a loop: finish the chain.
            this.startPoint = null;
            this.wallChainStart = null;
            this.wallChainCount = 0;
        } else {
            // Start the next wall at the endpoint just created.
            this.startPoint = finalEnd;
        }
    }

    hasWallPath(start, end, samePoint) {
        // Temporarily split at the proposed connection points so the
        // path search recognizes points inside existing walls.
        const walls = WallTopology.split(
            this.engine.elements,
            [start, end]
        ).filter(element => element.type === 'wall');

        const queue = [{ point: start, depth: 0 }];
        const visited = [start];

        for (let i = 0; i < queue.length; i++) {
            const { point, depth } = queue[i];
            for (const wall of walls) {
                const next = samePoint(point, wall.start) ? wall.end
                    : samePoint(point, wall.end) ? wall.start : null;
                if (!next) continue;
                if (samePoint(next, end) && depth + 1 >= 2) return true;
                if (!visited.some(visitedPoint => samePoint(visitedPoint, next))) {
                    visited.push(next);
                    queue.push({ point: next, depth: depth + 1 });
                }
            }
        }
        return false;
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
                !this.startPoint ||
                !this.directionPoint ||
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
                this.startPoint &&
                this.directionPoint &&
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
        this.createWallWithLength(length);
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
        if (this.activeTool === 'wall' && this.startPoint && this.directionPoint) {
            this.renderWallPreview();
        }
    }
}
