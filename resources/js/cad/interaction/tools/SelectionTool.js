/** Owns selection gestures; SelectionManager owns hit testing and selected identity.
 * Coordinates arrive unsnapped. Model mutations stay in DrawingEngine.
 */
export default class SelectionTool {
    constructor({ engine, selectionManager, getScale, requestRender, renderSelection, renderBox, clearBox }) {
        Object.assign(this, { engine, selectionManager, getScale, requestRender, renderSelection, renderBox, clearBox });
        this.cancel();
    }

    get isDragging() {
        return this.drag !== null;
    }

    get hasSelection() {
        return this.selectionManager.selectedElements.length > 0;
    }

    handleClick(point) {
        this.selectionManager.select(
            point, this.engine.elements, this.engine.getWallDisplayGeometry()
        );
        this.renderSelection(this.selectionManager.selectedIds);
    }

    startBox(point) {
        this.drag = null;
        this.box = { start: point, end: point };
        this.renderBox(point, point);
    }

    updateBox(point) {
        this.box.end = point;
        this.renderBox(this.box.start, point);
    }

    finishBox(point, suppressClick) {
        const { start } = this.box;
        const minX = Math.min(start.x, point.x), maxX = Math.max(start.x, point.x);
        const minY = Math.min(start.y, point.y), maxY = Math.max(start.y, point.y);
        const geometry = this.engine.getWallDisplayGeometry();
        const selected = this.engine.elements.filter(element => {
            const corners = geometry.get(element.id) ?? element.getGeometry();
            return corners.every(corner => corner.x >= minX && corner.x <= maxX && corner.y >= minY && corner.y <= maxY);
        });
        this.box = null;
        this.clearBox();
        this.selectionManager.setSelection(selected);
        this.renderSelection(this.selectionManager.selectedIds);
        this.suppressNextClick = suppressClick;
    }

    startDrag(point) {
        const group = this.selectionManager.selectedElements;
        if (group.length > 1) {
            const geometry = this.engine.getWallDisplayGeometry();
            const inside = group.some(element => this.selectionManager.isPointInsidePolygon(
                point, geometry.get(element.id) ?? element.getGeometry()
            ));
            if (inside) this.drag = { type: 'group', start: point, last: point, moved: false };
            return;
        }
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
        if (this.drag?.type === 'group') {
            const drag = this.drag;
            if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) * this.getScale() <= 2) return;
            this.engine.moveElements(this.selectionManager.selectedElements, point.x - drag.last.x, point.y - drag.last.y);
            drag.last = point;
            drag.moved = true;
            this.requestRender();
            return;
        }
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

        if (this.drag?.type === 'column') {
            const column = this.selectionManager.selectedElement;

            if (!column) {
                this.endDrag();
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
        if (this.drag?.type === 'wall' || this.drag?.type === 'group') {
            this.suppressNextClick = this.drag.moved;
        }

        if (this.drag) this.engine.recordHistory();
        this.drag = null;
    }

    // A completed wall drag can produce a click; ignore that event once.
    consumeNextClick() {
        const suppress = this.suppressNextClick;
        this.suppressNextClick = false;
        return suppress;
    }

    cancel({ clearSelection = false } = {}) {
        if (this.drag) this.engine.recordHistory();
        this.drag = null;
        if (this.box) this.clearBox();
        this.box = null;
        this.suppressNextClick = false;
        if (clearSelection) this.selectionManager.clear();
    }

    deleteSelected() {
        if (!this.hasSelection) return;
        this.endDrag();
        this.engine.removeElements(this.selectionManager.selectedIds);
        this.cancel({ clearSelection: true });
    }
}
