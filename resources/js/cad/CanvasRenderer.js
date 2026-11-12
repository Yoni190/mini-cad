export default class CanvasRenderer {
    constructor (canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 1 Canvas pixel = 10 millimeters
        this.scale = 0.1;

        this.offsetX = 0;
        this.offsetY = 0;
    }

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

    //Convert screen coordinates to world coordinates
    screenToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.scale,
            y: (y - this.offsetY) / this.scale
        };
    }

    //Convert world coordinates to screen coordinates
    worldToScreen(x, y) {
        return {
            x: (x * this.scale) + this.offsetX,
            y: (y * this.scale) + this.offsetY
        };
    }

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

    clear() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
