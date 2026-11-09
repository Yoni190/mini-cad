import GeometryService from './GeometryService'

export default class CanvasRenderer {
    constructor (canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // 1 Canvas pixel = 10 millimeters
        this.scale = 0.1;
    }

    drawWall(wall, isPreview = false) {
        const corners = GeometryService.getWallCorners(wall);

        const ctx = this.ctx;

        ctx.beginPath();

        //Move to the first corner
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

        ctx.fillStyle = isPreview
            ? 'rgba(0, 255, 255, 0.2)'
            : 'cyan';

        ctx.strokeStyle = isPreview ? 'blue' : 'black';

        ctx.fill();
        ctx.stroke();
    }

    screenToWorld(x, y) {
        return {
            x: x / this.scale,
            y: y / this.scale
        };
    }
}