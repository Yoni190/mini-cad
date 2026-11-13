import GeometryService from "../GeometryService";
import DrawingElement from "./DrawingElement";

export default class Wall extends DrawingElement {
    
    constructor ({ start, end, thickness = 200, height = 3000, id }) {
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
        this.start = { ...start };
        this.end = { ...end };
        this.thickness = thickness;
        this.height = height;
    }

    /**
     * Measures the stored start-to-end reference edge in millimeters.
     * Display joins and camera changes do not affect this distance.
     */
    getLength() {
        //Euclidean distance
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;

        const length = Math.hypot(dx, dy);

        return length;
    }

    getGeometry() {
        return GeometryService.getWallCorners(this);
    }
}