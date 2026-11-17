import GeometryService from "../geometry/GeometryService";
import DrawingElement from "./DrawingElement";

export default class Wall extends DrawingElement {
    
    constructor ({
        start,
        end,
        thickness = 200,
        height = 3000,
        thicknessSide = 1,
        openings = [],
        id,
    }) {
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

        //Move to helper function
        if (!Array.isArray(openings)) {
            throw new Error('Wall openings must be an array.');
        }

        const wallLength = this.getLength();
        const sortedOpenings = [...openings].sort((a, b) => a.offset - b.offset);

        for (let i = 0; i < sortedOpenings.length; i++) {
            const opening = sortedOpenings[i];
            const isWindow = opening?.type === 'window';
            const sillHeight = isWindow ? opening.sillHeight : 0;

            if (
                !opening ||
                !Number.isFinite(opening.offset) ||
                !Number.isFinite(opening.width) ||
                !Number.isFinite(opening.height) ||
                opening.offset < 0 ||
                opening.width <= 0 ||
                (opening.type !== undefined && opening.type !== 'window') ||
                !Number.isFinite(sillHeight) ||
                sillHeight < 0 ||
                sillHeight + opening.height > height ||
                opening.offset + opening.width > wallLength ||
                opening.height > height
            ) {
                throw new Error('Invalid wall opening.');
            }

            const previous = sortedOpenings[i - 1];

            if (previous && previous.offset + previous.width > opening.offset) {
                throw new Error('Wall openings cannot overlap.');
            }
        }

        this.openings = sortedOpenings.map(opening => ({ ...opening }));
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