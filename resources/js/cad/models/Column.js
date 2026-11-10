import GeometryService from "../GeometryService";
import DrawingElement from "./DrawingElement";

export default class Column extends DrawingElement {
    constructor({
        position,
        width = 400,
        depth = 400,
        height = 3000,
        id
    }) {
        super('column', id);

        if(!position ||
            !Number.isFinite(position.x) ||
            !Number.isFinite(position.y)
        ) {
            throw new Error('Invalid column position');
        }

        if(!Number.isFinite(width) || width <= 0) {
            throw new Error('Column width must be a positive number');
        }

        if(!Number.isFinite(depth) || depth <= 0) {
            throw new Error('Column depth must be a positive number');
        }

        if(!Number.isFinite(height) || height <= 0) {
            throw new Error('Column height must be a positive number');
        }

        this.position = { ...position };
        this.width = width;
        this.depth = depth;
        this.height = height;
    }

    getGeometry() {
        return GeometryService.getColumnCorners(this);
    }
}