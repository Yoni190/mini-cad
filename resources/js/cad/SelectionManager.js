export default class SelectionManager {
    constructor() {
        this.selectedElement = null;
    }

    select(point, elements, wallGeometry = null) {
        this.selectedElement = null;

        for (let i = elements.length - 1; i >= 0; i--) {
            const element = elements[i];
            
            if (element.type === 'column') {
                if (this.isPointInsideColumn(point, element)) {
                    this.selectedElement = element;
                    break;
                }
            }

            if (element.type === 'wall') {
                const corners = wallGeometry?.get(element.id)
                    ?? element.getGeometry();

                if (this.isPointInsidePolygon(point, corners)) {
                    this.selectedElement = element;
                    break;
                }
            }
        }
        
        return this.selectedElement;
    }

    clear() {
        this.selectedElement = null;
    }

    isPointInsideColumn(point, column) {
        const { position, width, depth } = column;

        return (
            point.x >= position.x &&
            point.x <= position.x + width &&
            point.y >= position.y &&
            point.y <= position.y + depth
        );
    }

    isPointInsidePolygon(point, corners) {
        let inside = false;

        for (
            let i = 0, j = corners.length - 1;
            i < corners.length;
            j = i++
        ) {
            const xi = corners[i].x;
            const yi = corners[i].y;

            const xj = corners[j].x;
            const yj = corners[j].y;

            const intersects =
                ((yi > point.y) !== (yj > point.y)) &&
                (point.x <
                    ((xj - xi) * (point.y - yi)) /
                    (yj - yi) + xi
                );

            if (intersects) {
                inside = !inside;
            }
        }

        return inside;
    }
}