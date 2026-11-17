import GeometryService from '../../geometry/GeometryService';
import Wall from '../../models/Wall';
import WallTopology from '../../geometry/WallTopology';

/** Owns pending wall drafting. Only engine mutations commit geometry.
 * Inputs and preview callbacks keep browser UI and frame scheduling outside the tool.
 */
export default class WallDrawingTool {
    constructor({ engine, snapManager, inputs, getScale, preview, showMessage, now = () => performance.now() }) {
        Object.assign(this, { engine, snapManager, inputs, getScale, preview, showMessage, now });
        this.orthoEnabled = false;
        this.cancel();
    }

    get hasPreview() {
        return Boolean(this.startPoint && this.directionPoint);
    }

    handleClick(point) {
        if (this.startPoint === null) {
            this.alignmentHold = { x: null, y: null };
            this.preview.clear();
            this.startPoint = point;
            this.wallChainStart = { ...point };
            this.wallChainCount = 0;
            this.directionPoint = null;

            // Start each wall without a leftover length from the previous one.
            this.inputs.setLength('');
        } else {
            // The second click determines the direction.
            this.directionPoint = point;

            const length = Number(this.inputs.getLength());

            if (Number.isFinite(length) && length > 0) {
                this.createWallWithLength(length);
            } else {
                this.commitWall(this.constrainWallPoint(point));
            }
        }
    }

    handleMouseMove(point) {
        if (this.startPoint) {
            this.directionPoint = point;
            // Pointer movement takes control of length again.
            // this.inputs.setLength('');
            this.preview.request();
        } else {
            this.preview.showStartHints(point);
        }
    }

    handleKeyDown(event) {
        const value = this.inputs.getLength();

        if (/^[0-9]$/.test(event.key)) {
            event.preventDefault();
            this.inputs.setLength(value + event.key);
            this.preview.render();
            return true;
        }

        if (event.key === '.' && !value.includes('.')) {
            event.preventDefault();
            // A number input cannot retain a trailing decimal point reliably,
            // so type whole millimeters with this shortcut.
            return true;
        }

        if (event.key === 'Backspace') {
            event.preventDefault();
            this.inputs.setLength(value.slice(0, -1));
            this.preview.render();
            return true;
        }

        if (event.key === 'Enter') {
            event.preventDefault();

            const length = Number(value);
            if (Number.isFinite(length) && length > 0) {
                this.createWallWithLength(length);
            }

            return true;
        }

        if (event.key === 'Escape' && value !== '') {
            event.preventDefault();
            this.inputs.setLength('');
            this.preview.render();
            return true;
        }
        return false;
    }

    getSnappedPoint(rawPoint) {
        const start = this.startPoint;

        // Apply guides and Ortho before choosing a wall connection.
        const point = start
            ? this.constrainWallPoint(this.alignWallPoint(rawPoint))
            : rawPoint;

        let constraint = null;

        if (start && this.orthoEnabled) {
            const axis = point.x === start.x ? 'x' : 'y';

            constraint = {
                axis,
                value: start[axis]
            };
        }

        const tolerance = 20 / this.getScale();

        return this.snapManager.snap(
            point,
            this.engine.findWallsNear(point, tolerance),
            tolerance,
            constraint
        );
    }

    createWallWithLength(length) {
        const direction = this.directionPoint
            ? this.constrainWallPoint(this.directionPoint)
            : null;

        if(!this.startPoint || !direction) {
            this.showMessage('Click a starting point and move the mouse to choose a direction.');
            return;
        }
        if(this.startPoint.x === direction.x &&
            this.startPoint.y === direction.y
        ) {
            this.showMessage('Move the mouse to choose a wall direction first.');
            return;
        }

        const newEndpoint = this.resolveEndpoint(length);

        this.commitWall(newEndpoint);
    }

    cancel() {
        this.startPoint = null;
        this.directionPoint = null;
        this.wallChainStart = null;
        this.wallChainCount = 0;
        this.alignmentHold = { x: null, y: null };
        this.inputs.setLength('');
    }

    alignWallPoint(point) {
        if (!this.startPoint) return point;

        const threshold = 8 / this.getScale();
        const aligned = { ...point };

        const references = [this.startPoint];

        for (const wall of this.engine.elements) {
            if (wall.type !== 'wall') continue;

            references.push(
                wall.start,
                wall.end,
                {
                    x: (wall.start.x + wall.end.x) / 2,
                    y: (wall.start.y + wall.end.y) / 2,
                }
            );
        }

        for (const axis of ['x', 'y']) {
            let closestDistance = threshold;

            for (const reference of references) {
                const distance = Math.abs(point[axis] - reference[axis]);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    aligned[axis] = reference[axis];
                }
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
        this.orthoEnabled = !this.orthoEnabled;
        this.inputs.setOrtho(this.orthoEnabled);
    }

    /** Both preview and numeric commits resolve length from the constrained direction. */
    resolveEndpoint(length) {
        const direction = this.directionPoint ? this.constrainWallPoint(this.directionPoint) : null;
        if (!this.startPoint || !direction) return null;
        return Number.isFinite(length) && length > 0
            ? GeometryService.getEndPoint(this.startPoint, direction, length)
            : direction;
    }

    getPreview() {
        const start = this.startPoint;
        const direction = this.directionPoint ? this.constrainWallPoint(this.directionPoint) : null;
        if (!start || !direction || (start.x === direction.x && start.y === direction.y)) return null;
        const end = this.resolveEndpoint(Number(this.inputs.getLength()));
        const thickness = this.inputs.getThickness();
        if (thickness === null) return null;
        return new Wall({
            start, end, thickness,
            thicknessSide: GeometryService.resolveWallThicknessSide(start, end, this.engine.elements),
        });
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
            this.showMessage('A room needs at least three walls.');
            return;
        }

        // Use the exact original coordinates when closing the chain.
        const finalEnd = closesChain
            ? { ...this.wallChainStart }
            : { ...end };

        const thickness = this.inputs.getThickness(true);
        if (thickness === null) return;

        // An existing path between the endpoints also completes a room,
        // even when the chain began on an existing wall.
        let closesExistingPath;

        try {
            closesExistingPath = WallTopology.hasPath(
                this.engine.elements,
                start,
                finalEnd
            );

            this.engine.addWall(start, finalEnd, thickness);
        } catch (error) {
            this.showMessage(error.message);
            return;
        }
        this.wallChainCount++;

        this.inputs.setLength('');
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
}
