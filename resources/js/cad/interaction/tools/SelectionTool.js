/** Owns selection gestures; SelectionManager owns hit testing and selected identity.
 * Coordinates arrive unsnapped. Model mutations stay in DrawingEngine.
 */
export default class SelectionTool {
    constructor({ engine, selectionManager, getScale, requestRender, renderSelection }) {
        Object.assign(this, { engine, selectionManager, getScale, requestRender, renderSelection });
        this.cancel();
    }

    get isDragging() {
        return this.drag !== null;
    }

    get hasSelection() {
        return Boolean(this.selectionManager.selectedElement);
    }

    handleClick(point) {
        const selected = this.selectionManager.select(
            point, this.engine.elements, this.engine.getWallDisplayGeometry()
        );
        this.renderSelection(selected?.id ?? null);
    }

    startDrag(point) {
        const selected = this.selectionManager.selectedElement;

        if (selected?.type === 'wall') {
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

            this.drag = {
                type: 'wall',
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
        const column = selected;

        if (!column || column.type !== 'column') {
            return;
        }

        if (!this.selectionManager.isPointInsideColumn(point, column)) {
            return;
        }

        this.drag = {
            type: 'column',
            offset: { x: point.x - column.position.x, y: point.y - column.position.y },
        };
    }

    updateDrag(point) {
        if (this.drag?.type === 'wall') {
            const drag = this.drag;

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

            if (Math.hypot(mouseDx, mouseDy) * this.getScale() > 2) {
                drag.moved = true;
            }

            this.requestRender();
            return;
        }

        // Handle column dragging
        if (this.drag?.type === 'column') {
            const column = this.selectionManager.selectedElement;

            if (!column) {
                this.drag = null;
                return;
            }

            const moved = this.engine.moveColumn(column.id, {
                x: point.x - this.drag.offset.x,
                y: point.y - this.drag.offset.y
            });

            if (moved) this.requestRender();
        }
    }

    endDrag() {
        if (this.drag?.type === 'wall') this.suppressNextClick = this.drag.moved;
        this.drag = null;
    }

    // A completed wall drag can produce a click; ignore that event once.
    consumeNextClick() {
        const suppress = this.suppressNextClick;
        this.suppressNextClick = false;
        return suppress;
    }

    cancel({ clearSelection = false } = {}) {
        this.drag = null;
        this.suppressNextClick = false;
        if (clearSelection) this.selectionManager.clear();
    }

    deleteSelected() {
        const selected = this.selectionManager.selectedElement;
        if (!selected) return;
        this.engine.removeElement(selected.id);
        this.cancel({ clearSelection: true });
    }
}
