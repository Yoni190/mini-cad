import GeometryService from "../geometry/GeometryService";
import DrawingElement from "./DrawingElement";

export default class Wall extends DrawingElement {
    
    constructor ({ start, end, thickness = 200, height = 3000, thicknessSide = 1, id }) {
        super('wall', id);

        const validPoint = (point) =>
            point &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y);

        if (!validPoint(start) || !validPoint(end)) {
            throw new Error('Invalid wall start or end point');
        }

        if(!Number.isFinite(thickness) || thickness <= 0) {
            throw new Error('Wall thickness must be a positive number');
        }

        if(!Number.isFinite(height) || height <= 0) {
            throw new Error('Wall height must be a positive number');
        }

        if(start.x === end.x && start.y === end.y) {
            throw new Error('Start and end points must not be identical.')
        }
        if (![1, -1].includes(thicknessSide)) {
            throw new Error('Wall thickness side must be 1 or -1');
        }

        this.start = { ...start };
        this.end = { ...end };
        this.thickness = thickness;
        this.height = height;
        this.thicknessSide = thicknessSide;
    }

    /**
     * Measures the stored start-to-end reference edge in millimeters.
     * Display joins and camera changes do not affect this distance.
     */

    getLength() {
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;

        return Math.hypot(dx, dy);
    }

    getGeometry() {
        return GeometryService.getWallCorners(this);
    }
}