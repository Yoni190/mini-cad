export default class DrawingElement {
    constructor(type, id = crypto.randomUUID()) {
        if (new.target === DrawingElement) {
            throw new Error('DrawingElement cannot be instantiated directly');
        }

        this.id = id;
        this.type = type;
    }

    getGeometry() {
        throw new Error('getGeometry() must be implemented by subclasses');
    }
}