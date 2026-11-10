export default class SelectionManager {
    constructor() {
        this.selectedElement = null;
    }

    select(point, elements) {
        this.selectedElement = null;

        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            
            if (element.type !== 'column') {
                continue;
            }

            const { position, width, depth } = element;

            const betweenX =
                point.x >= position.x &&
                point.x <= position.x + width;

            const betweenY =
                point.y >= position.y &&
                point.y <= position.y + depth;

            if (betweenX && betweenY) {
                this.selectedElement = element;
                return element;
            }
        }
        
        return this.selectedElement;
    }

    clear() {
        this.selectedElement = null;
    }
}