export default class DrawingElement {
    constructor(type, id = crypto.randomUUID()) {
        if (new.target === DrawingElement) {
            throw new Error('DrawingElement cannot be instantiated directly');
        }

        this.id = id;
        this.type = type;
    }

    /**
     * Defines the footprint interface that subclasses must implement.
     * Geometry is plain coordinate data, independent of rendering APIs.
     */
    getGeometry() {
        throw new Error('getGeometry() must be implemented by subclasses');
    }
}