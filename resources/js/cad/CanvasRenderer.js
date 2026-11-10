export default class CanvasRenderer {
    constructor (canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 1 Canvas pixel = 10 millimeters
        this.scale = 0.1;
    }

    drawElement(element, isPreview = false, isSelected = false){
        const corners = element.getGeometry();
        const ctx = this.ctx;

        ctx.beginPath();

        ctx.moveTo(
            corners[0].x * this.scale,
            corners[0].y * this.scale
        );

        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(
                corners[i].x * this.scale,
                corners[i].y * this.scale
            );
        }

        ctx.closePath();

        //Default style
        ctx.fillStyle = 'gray';
        ctx.strokeStyle = 'black';

        if(element.type === 'wall'){
            ctx.fillStyle = isPreview
            ? 'red'
            : 'cyan';

            ctx.strokeStyle = isPreview ? 'blue' : 'black';
        } else if (element.type === 'column') {
            ctx.fillStyle = isPreview
            ? 'yellow'
            : 'green';

            ctx.strokeStyle = isPreview ? 'blue' : 'black';
        }

        if (isSelected) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 3;
        } else {
            ctx.lineWidth = 1;
        }

        ctx.fill();
        ctx.stroke();
    }

    screenToWorld(x, y) {
        return {
            x: x / this.scale,
            y: y / this.scale
        };
    }

    drawWallLength (wall) {
        const ctx = this.ctx;
        const { start, end } = wall;

        //Calculate wall midpoints (in pixels)
        const midX = ((start.x + end.x) / 2) * this.scale;
        const midY = ((start.y + end.y) / 2) * this.scale;

        //Get wall length
        const length = wall.getLength();
        const label = `${Math.round(length)} mm`

        ctx.save();

        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        ctx.fillText(label, midX, midY - 10);

        ctx.restore();
    }

    clear() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}