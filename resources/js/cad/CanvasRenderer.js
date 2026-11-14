export default class CanvasRenderer {
    constructor (canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 1 Canvas pixel = 10 millimeters
        this.scale = 0.1;

        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * Draws an element footprint after converting millimeters to pixels.
     *
     * Joined walls may supply custom corners; other elements provide
     * their own geometry through the common getGeometry() interface.
     */
    drawElement(
        element,
        isPreview = false,
        isSelected = false,
        customCorners = null
    ){
        const corners = customCorners ?? element.getGeometry();
        const ctx = this.ctx;

        ctx.save();
        ctx.beginPath();

        const firstPoint = this.worldToScreen(
            corners[0].x,
            corners[0].y
        );

        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < corners.length; i++) {
            const point = this.worldToScreen(
                corners[i].x,
                corners[i].y
            );

            ctx.lineTo(point.x, point.y);
        }

        ctx.closePath();

        ctx.fillStyle = isPreview ? 'rgba(70, 112, 164, 0.25)'
            : element.type === 'column' ? '#9baaba' : '#c3ced8';
        ctx.strokeStyle = isSelected ? '#245ec7'
            : isPreview ? '#5279a8' : '#526374';
        ctx.lineWidth = isSelected ? 3 : 1.25;
        ctx.lineJoin = 'round';
        if (isPreview) ctx.setLineDash([6, 4]);

        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    isGeometryVisible(corners) {
        // Include a small margin for the element's stroke.
        const margin = 4;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const corner of corners) {
            const point = this.worldToScreen(corner.x, corner.y);

            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return (
            maxX >= -margin &&
            maxY >= -margin &&
            minX <= this.canvas.width + margin &&
            minY <= this.canvas.height + margin
        );
    }

    /**
     * Converts canvas pixels into drawing millimeters by reversing
     * the current pan offset and zoom scale.
     */
    screenToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.scale,
            y: (y - this.offsetY) / this.scale
        };
    }

    /**
     * Converts drawing millimeters into canvas pixels using the
     * current zoom scale and pan offset. Stored geometry is unchanged.
     */
    worldToScreen(x, y) {
        return {
            x: (x * this.scale) + this.offsetX,
            y: (y * this.scale) + this.offsetY
        };
    }

    /**
     * Draws the measured reference-edge length near the wall midpoint.
     *
     * The upward offset is in screen pixels, so the label spacing
     * stays constant while zooming. The white stroke adds contrast.
     */
    drawWallLength (wall) {
        const ctx = this.ctx;
        const { start, end } = wall;

        //Calculate wall midpoints (in pixels)
        const midpoint = this.worldToScreen(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2
        );

        //Get wall length
        const length = wall.getLength();
        const label = `${Math.round(length)} mm`

        ctx.save();

        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // A light halo keeps measurements readable over elements and grid lines.
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeText(label, midpoint.x, midpoint.y - 10);
        ctx.fillStyle = '#334155';
        ctx.fillText(label, midpoint.x, midpoint.y - 10);

        ctx.restore();
    }

    /**
     * Draws a grid spaced in world millimeters.
     *
     * Scaling the spacing and applying the pan offsets keeps grid
     * lines aligned with the drawing while the view moves.
     */
    drawGrid() {
        const gridSize = 1000; // Millimeters
        const spacing = gridSize * this.scale;

        const ctx = this.ctx;

        // Calculate where the grid begins on the screen
        const startX = ((this.offsetX % spacing) + spacing) % spacing;
        const startY = ((this.offsetY % spacing) + spacing) % spacing;

        ctx.save();
        
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = startX; x <= this.canvas.width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = startY; y <= this.canvas.height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawWallGuides(preview, elements) {
        const ctx = this.ctx;
        const threshold = 8; // Screen pixels
        const end = this.worldToScreen(preview.end.x, preview.end.y);
        const start = this.worldToScreen(preview.start.x, preview.start.y);

        let closestX = null;
        let closestY = null;
        let closestMidpoint = null;

        const considerPoint = (point, isMidpoint = false) => {
            const screen = this.worldToScreen(point.x, point.y);
            const dx = Math.abs(screen.x - end.x);
            const dy = Math.abs(screen.y - end.y);
            const distance = Math.hypot(dx, dy);

            if (dx <= threshold && (!closestX || dx < closestX.distance)) {
                closestX = { point: screen, distance: dx };
            }

            if (dy <= threshold && (!closestY || dy < closestY.distance)) {
                closestY = { point: screen, distance: dy };
            }

            if (
                isMidpoint &&
                distance <= threshold &&
                (!closestMidpoint || distance < closestMidpoint.distance)
            ) {
                closestMidpoint = { point: screen, distance };
            }
        };

        for (const element of elements) {
            if (element.type !== 'wall') continue;

            considerPoint(element.start);
            considerPoint(element.end);
            considerPoint({
                x: (element.start.x + element.end.x) / 2,
                y: (element.start.y + element.end.y) / 2,
            }, true);
        }

        ctx.save();
        ctx.strokeStyle = '#d97706';
        ctx.fillStyle = '#92400e';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Draw a guide through the nearby reference point.
        if (closestX) {
            ctx.beginPath();
            ctx.moveTo(closestX.point.x, 0);
            ctx.lineTo(closestX.point.x, this.canvas.height);
            ctx.stroke();
        }

        if (closestY) {
            ctx.beginPath();
            ctx.moveTo(0, closestY.point.y);
            ctx.lineTo(this.canvas.width, closestY.point.y);
            ctx.stroke();
        }

        // Indicate when the preview itself is nearly horizontal or vertical.
        if (Math.abs(end.y - start.y) <= threshold) {
            ctx.beginPath();
            ctx.moveTo(0, start.y);
            ctx.lineTo(this.canvas.width, start.y);
            ctx.stroke();
        }

        if (Math.abs(end.x - start.x) <= threshold) {
            ctx.beginPath();
            ctx.moveTo(start.x, 0);
            ctx.lineTo(start.x, this.canvas.height);
            ctx.stroke();
        }

        // Mark a nearby wall midpoint with a small diamond.
        if (closestMidpoint) {
            const { x, y } = closestMidpoint.point;
            const size = 6;

            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.moveTo(x, y - size);
            ctx.lineTo(x + size, y);
            ctx.lineTo(x, y + size);
            ctx.lineTo(x - size, y);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    drawSnapMarker(point) {
        const screen = this.worldToScreen(point.x, point.y);
        const ctx = this.ctx;

        ctx.save();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    clear() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
