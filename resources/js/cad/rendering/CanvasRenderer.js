import WallTopology from '../geometry/WallTopology';

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

    drawDoor(wall, opening, isSelected = false) {
        const length = wall.getLength();

        // Unit vector pointing from the wall's start to its end.
        const dx = (wall.end.x - wall.start.x) / length;
        const dy = (wall.end.y - wall.start.y) / length;

        // The hinge sits at the start of the opening.
        const hinge = this.worldToScreen(
            wall.start.x + dx * opening.offset,
            wall.start.y + dy * opening.offset
        );

        const radius = opening.width * this.scale;
        const closedAngle = Math.atan2(dy, dx);
        const side = wall.thicknessSide;
        const openAngle = closedAngle + side * Math.PI / 2;

        const ctx = this.ctx;

        ctx.save();
        ctx.strokeStyle = isSelected ? '#245ec7' : '#526374';
        ctx.lineWidth = isSelected ? 2 : 1.25;

        // Draw the door leaf in its open position.
        ctx.beginPath();
        ctx.moveTo(hinge.x, hinge.y);
        ctx.lineTo(
            hinge.x + radius * Math.cos(openAngle),
            hinge.y + radius * Math.sin(openAngle)
        );
        ctx.stroke();

        // Draw the path the door follows as it swings.
        ctx.beginPath();
        ctx.arc(
            hinge.x,
            hinge.y,
            radius,
            closedAngle,
            openAngle,
            side < 0
        );
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

        const midpoint = this.worldToScreen(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2
        );

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

        const startX = ((this.offsetX % spacing) + spacing) % spacing;
        const startY = ((this.offsetY % spacing) + spacing) % spacing;

        ctx.save();
        
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;

        ctx.beginPath();

        for (let x = startX; x <= this.canvas.width; x += spacing) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
        }

        for (let y = startY; y <= this.canvas.height; y += spacing) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
        }

        ctx.stroke();

        ctx.restore();
    }

    drawWallGuides(preview, elements) {
        const ctx = this.ctx;
        const threshold = 8; // Screen pixels
        const end = this.worldToScreen(preview.end.x, preview.end.y);
        const start = preview.start
            ? this.worldToScreen(preview.start.x, preview.start.y)
            : null;

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
        if (start && Math.abs(end.y - start.y) <= threshold) {
            ctx.beginPath();
            ctx.moveTo(0, start.y);
            ctx.lineTo(this.canvas.width, start.y);
            ctx.stroke();
        }

        if (start && Math.abs(end.x - start.x) <= threshold) {
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

    drawSelectionBox(start, end) {
        const a = this.worldToScreen(start.x, start.y);
        const b = this.worldToScreen(end.x, end.y);
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(36, 94, 199, 0.12)';
        ctx.strokeStyle = '#245ec7';
        ctx.setLineDash([5, 3]);
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
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

    drawMeasurement(start, end) {
        const ctx = this.ctx;
        const a = this.worldToScreen(start.x, start.y);
        const b = this.worldToScreen(end.x, end.y);

        const distance = Math.hypot(
            end.x - start.x,
            end.y - start.y
        );

        ctx.save();

        // Measurement line
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // Endpoint markers
        ctx.setLineDash([]);
        ctx.fillStyle = '#d97706';

        for (const point of [a, b]) {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Measurement label
        const midX = (a.x + b.x) / 2;
        const midY = (a.y + b.y) / 2 - 12;
        const label = `${Math.round(distance)} mm`;

        ctx.font = '600 13px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeText(label, midX, midY);
        ctx.fillStyle = '#92400e';
        ctx.fillText(label, midX, midY);

        ctx.restore();
    }

    drawWallCornerAngles(walls) {
        const junctions = new Map();
        for (const wall of walls) {
            for (const [point, other] of [[wall.start, wall.end], [wall.end, wall.start]]) {
                const key = `${point.x},${point.y}`;
                if (!junctions.has(key)) junctions.set(key, { point, rays: [] });
                junctions.get(key).rays.push({
                    angle: Math.atan2(other.y - point.y, other.x - point.x),
                    thickness: wall.thickness,
                });
            }
        }

        const ctx = this.ctx;
        ctx.save();
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillStyle = '#334155';
        for (const { point, rays } of junctions.values()) {
            if (rays.length < 2) continue;
            rays.sort((a, b) => a.angle - b.angle);
            const screen = this.worldToScreen(point.x, point.y);
            for (let i = 0; i < rays.length; i++) {
                const a = rays[i];
                const b = rays[(i + 1) % rays.length];
                const gap = (b.angle - a.angle + 2 * Math.PI) % (2 * Math.PI);
                if (gap < 1e-8 || gap >= Math.PI - 1e-8) continue;
                const direction = a.angle + gap / 2;
                const offset = 30 + Math.max(a.thickness, b.thickness) * this.scale / 2;
                const x = screen.x + Math.cos(direction) * offset;
                const y = screen.y + Math.sin(direction) * offset;
                const label = `${Math.round(gap * 180 / Math.PI)}°`;
                ctx.strokeText(label, x, y);
                ctx.fillText(label, x, y);
            }
        }
        ctx.restore();
    }

    drawWallAngle(wall, nearbyWalls = []) {
        const { start, end } = wall;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        let degrees = Math.atan2(-dy, dx) * 180 / Math.PI;
        const angles = [];
        for (const connected of nearbyWalls) {
            if (WallTopology.project(start, connected).distance > 1e-6) continue;
            for (const point of [connected.start, connected.end]) {
                const x = point.x - start.x;
                const y = point.y - start.y;
                if (Math.hypot(x, y) <= 1e-6) continue;
                angles.push(Math.atan2(Math.abs(dx * y - dy * x), dx * x + dy * y) * 180 / Math.PI);
            }
        }
        if (angles.length) degrees = Math.min(...angles);
        const angle = ((Math.round(degrees) % 360) + 360) % 360;
        const midpoint = this.worldToScreen(
            (start.x + end.x) / 2,
            (start.y + end.y) / 2
        );

        const ctx = this.ctx;
        ctx.save();
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillStyle = '#334155';
        ctx.strokeText(`${angle}°`, midpoint.x, midpoint.y + 10);
        ctx.fillText(`${angle}°`, midpoint.x, midpoint.y + 10);
        ctx.restore();
    }

    drawWallFaceLengths(corners) {
        const ctx = this.ctx;

        // The midpoint of the wall footprint helps us place each label
        // on the outside of its corresponding face.
        const center = {
            x: corners.reduce((sum, point) => sum + point.x, 0) / 4,
            y: corners.reduce((sum, point) => sum + point.y, 0) / 4,
        };

        const faces = [
            [corners[0], corners[1]], // Reference face
            [corners[3], corners[2]], // Opposite face
        ];

        ctx.save();
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillStyle = '#334155';

        for (const [start, end] of faces) {
            const length = Math.hypot(
                end.x - start.x,
                end.y - start.y
            );

            if (length === 0) continue;

            const midpoint = {
                x: (start.x + end.x) / 2,
                y: (start.y + end.y) / 2,
            };

            // Pick the normal that points away from the wall footprint.
            let normalX = -(end.y - start.y) / length;
            let normalY = (end.x - start.x) / length;

            const pointsOutward =
                normalX * (midpoint.x - center.x) +
                normalY * (midpoint.y - center.y);

            if (pointsOutward < 0) {
                normalX = -normalX;
                normalY = -normalY;
            }

            const screen = this.worldToScreen(midpoint.x, midpoint.y);
            const x = screen.x + normalX * 16;
            const y = screen.y + normalY * 16;
            const label = `${Math.round(length)} mm`;

            let angle = Math.atan2(end.y - start.y, end.x - start.x);

            // Keep the label readable when the wall points left.
            if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
                angle += Math.PI;
            }

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.strokeText(label, 0, 0);
            ctx.fillText(label, 0, 0);
            ctx.restore();
        }

        ctx.restore();
    }
}
