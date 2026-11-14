import GeometryService from "./GeometryService";
import Wall from "./models/Wall";

export default class EditorController {
    constructor(canvas, engine, renderer, snapManager, selectionManager) {
        this.canvas = canvas;
        this.engine = engine;
        this.renderer = renderer;
        this.snapManager = snapManager;
        this.activeTool = 'wall';
        this.directionPoint = null;
        this.selectionManager = selectionManager;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.lastPanPoint = null;
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

        document.getElementById('applyWallLength')
            .addEventListener('click', () => {
                const input = document.getElementById('wallLength');

                const length = Number(input.value);

                if (!Number.isFinite(length) || length <= 0) {
                    alert('Please enter a positive wall length.');
                    return;
                }

                this.createWallWithLength(length);
            })
        
        document.getElementById('drawingTool')
            .addEventListener('change', (event) => {
                this.activeTool = event.target.value;

                this.engine.startPoint = null;
                this.directionPoint = null;
                this.isDragging = false;
                this.selectionManager.clear();

                this.engine.render();
            });

        document.getElementById('updateColumn')
            .addEventListener('click', () => {
                if (this.isEditingLocked) return;
                
                const selected = this.selectionManager.selectedElement;

                if (!selected || selected.type !== 'column') {
                    alert('Please select a column first.');
                    return;
                }

                //Check that a column is selected
                if(this.activeTool === 'select') {
                    //Convert column dimensions input values into numbers
                    const width = Number(document.getElementById('columnWidth').value);
                    const depth = Number(document.getElementById('columnDepth').value);

                    if (
                        !Number.isFinite(width) || width <= 0 ||
                        !Number.isFinite(depth) || depth <= 0
                    ) {
                        alert('Width and depth must be positive numbers.');
                        return;
                    }

                    this.engine.updateColumnDimensions(selected.id, width, depth);
                }
            });

        document.getElementById('updateWallThickness')
            .addEventListener('click', () => {
                if (this.isEditingLocked || this.activeTool !== 'select') {
                    return;
                }

                const selected = this.selectionManager.selectedElement;

                if (selected?.type !== 'wall') {
                    alert('Please select a wall first.');
                    return;
                }

                const thickness = document.getElementById('wallThickness').value;

                try {
                    this.engine.updateWallThickness(selected.id, thickness);
                } catch (error) {
                    alert(error.message);
                }
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
        
        const point = this.getMousePoint(
            event,
            this.activeTool !== 'select'
        );

        if(this.activeTool === 'select') {
            const selected = this.selectionManager.select(
                point,
                this.engine.elements,
                this.engine.getWallDisplayGeometry()
            );

            this.engine.render(null, selected?.id ?? null);
            if(selected?.type === 'column') {
                document.getElementById('columnWidth').value = selected.width;
                document.getElementById('columnDepth').value = selected.depth;
            }

            document.getElementById('wallThickness').value =
                selected?.type === 'wall' ? selected.thickness : '';
            return;
        }

        if(this.activeTool === 'column') {
            this.engine.addColumn(point);
            return;
        }

        if (this.engine.startPoint === null) {
            this.engine.startPoint = point;
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
        // Handle panning
        if (this.isPanning) {
            const dx = event.clientX - this.lastPanPoint.x;
            const dy = event.clientY - this.lastPanPoint.y;

            this.renderer.offsetX += dx;
            this.renderer.offsetY += dy;

            this.lastPanPoint = {
                x: event.clientX,
                y: event.clientY
            };

            this.scheduleCanvasRender();

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

            // Check all connected walls before changing any geometry.
            // A wall cannot have identical start and end points.
            for (const connection of drag.connections) {
                const otherKey = connection.key === 'start' ? 'end' : 'start';
                const otherConnection = drag.connections.find(
                    item => item.wall === connection.wall && item.key === otherKey
                );

                const candidate = connection.junction === 'start' ? newStart : newEnd;
                const other = otherConnection
                    ? (otherConnection.junction === 'start' ? newStart : newEnd)
                    : connection.wall[otherKey];

                if (Math.hypot(candidate.x - other.x, candidate.y - other.y) < 0.001) {
                    return;
                }
            }

            drag.wall.start = newStart;
            drag.wall.end = newEnd;

            for (const connection of drag.connections) {
                connection.wall[connection.key] = {
                    ...(connection.junction === 'start' ? newStart : newEnd),
                };
            }

            this.engine.invalidateWallGeometry();

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

            column.position = {
                x: point.x - this.dragOffset.x,
                y: point.y - this.dragOffset.y
            };

            this.engine.notifyModelChange();
            this.scheduleCanvasRender();
            return;
        }

        // Wall Preview
        if (this.activeTool === 'wall' && this.engine.startPoint) {
            this.directionPoint = this.getMousePoint(event);
            
            // Mouse movement takes control of the wall length again.
            document.getElementById('wallLength').value = '';
            this.scheduleWallPreview();
        }
    }

    handleMouseDown(event) {
        if (this.isEditingLocked) return;
        if (event.button === 1) {
            event.preventDefault();

            this.isPanning = true;

            this.lastPanPoint = {
                x: event.clientX,
                y: event.clientY
            };

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
        this.isPanning = false;
        this.lastPanPoint = null;
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
            this.engine.startPoint !== null &&
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
            this.engine.startPoint = null;
            this.directionPoint = null;
            this.isDragging = false;
            this.selectionManager.clear();

            this.engine.render();
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

    /**
     * Zooms around the cursor while keeping its world point fixed.
     *
     * After changing scale, the pan offsets are recalculated so the
     * same drawing point remains underneath the mouse.
     */
    handleWheel(event) {
        if (this.isEditingLocked) return;
        event.preventDefault();

        // Get mouse position relative to the Canvas
        const rect = this.canvas.getBoundingClientRect();

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Find which world coordinate is under the cursor
        const worldPoint = this.renderer.screenToWorld(
            mouseX,
            mouseY
        );

        // Zoom in or out
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

        // Limit zoom so the drawing can't become
        // infinitely small or large
        const newScale = Math.min(
            2,
            Math.max(0.01, this.renderer.scale * zoomFactor)
        );

        // Skip redraws when zoom is at limit
        if (newScale === this.renderer.scale) {
            return;
        }

        this.renderer.scale = newScale;

        // Recalculate offsets so the world point
        // remains underneath the cursor
        this.renderer.offsetX =
            mouseX - worldPoint.x * newScale;

        this.renderer.offsetY =
            mouseY - worldPoint.y * newScale;

        // Redraw with the new scale and offsets
        this.scheduleCanvasRender();
    }


    /**
     * Converts browser mouse coordinates to canvas-local pixels,
     * then to millimeters, optionally snapping to a wall endpoint.
     */
    getMousePoint(event, applySnap = true) {
        //Read mouse coordinatess
        const rect = this.canvas.getBoundingClientRect();

        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        //Convert pixels to millimeters
        const rawPoint = this.renderer.screenToWorld(screenX, screenY);

        //Apply snapping (for walls)
        const snapRadiusPixels = 20;
        const snapRadiusWorld = snapRadiusPixels / this.renderer.scale;

        return applySnap
            ? this.snapManager.snap(
                rawPoint,
                this.engine.elements,
                snapRadiusWorld
            )
            : rawPoint;
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

        if(!this.engine.startPoint || !direction) {
            alert('Click a starting point and move the mouse to choose a direction.');
            return;
        }
        if(this.engine.startPoint.x === direction.x &&
            this.engine.startPoint.y === direction.y
        ) {
            alert('Move the mouse to choose a wall direction first.');
            return;
        }

        const newEndpoint = GeometryService.getEndPoint(
            this.engine.startPoint,
            direction,
            length
        );

        this.commitWall(newEndpoint);
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
            this.engine.startPoint = null;
            this.directionPoint = null;

            // Stop any active dragging or panning
            this.isDragging = false;
            this.isPanning = false;
            this.wallDrag = null;

            // Clear any drawing preview
            this.engine.render();
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

        const start = this.engine.startPoint;
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

        const preview = new Wall({ start, end });

        previewRenderer.drawElement(preview, true);
        previewRenderer.drawWallLength(preview);
        previewRenderer.drawWallGuides(preview, this.engine.elements);

        const isAtEndpoint = this.engine.elements.some(element =>
            element.type === 'wall' &&
            [element.start, element.end].some(point =>
                point.x === end.x && point.y === end.y
            )
        );

        if (isAtEndpoint) {
            previewRenderer.drawSnapMarker(end);
        }
    }

    constrainWallPoint(point) {
        const start = this.engine.startPoint;

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

        if (this.activeTool === 'wall' && this.engine.startPoint) {
            this.renderWallPreview();
        }
    }

    commitWall(end) {
        const start = this.engine.startPoint;

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

        this.engine.addWall(start, finalEnd);
        this.wallChainCount++;

        document.getElementById('wallLength').value = '';
        this.directionPoint = null;

        if (closesChain) {
            // The last wall reached the first point: finish the chain.
            this.engine.startPoint = null;
            this.wallChainStart = null;
            this.wallChainCount = 0;
        } else {
            // Start the next wall at the endpoint just created.
            this.engine.startPoint = finalEnd;
        }
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
                !this.engine.startPoint ||
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
            this.engine.render(
                null,
                this.selectionManager.selectedElement?.id ?? null
            );

            // A full redraw clears the preview overlay. Restore an active
            // preview using the current zoom and pan.
            if (
                !this.isEditingLocked &&
                this.activeTool === 'wall' &&
                this.engine.startPoint &&
                this.directionPoint &&
                document.getElementById('threeContainer').style.display === 'none'
            ) {
                this.renderWallPreview();
            }
        });
    }
}