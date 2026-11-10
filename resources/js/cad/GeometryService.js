export default class GeometryService {

    static getWallCorners (wall) {
        const { start, end, thickness } = wall;

        //Get wall length
        const length = wall.getLength();

        //Calculate dx and dy
        const dx = end.x - start.x;
        const dy = end.y - start.y;

        //Calculate perpendicular vector
        const nx = -dy / length;
        const ny = dx / length;

        const ox = nx * thickness;
        const oy = ny * thickness;

        return [
            { x: start.x, y: start.y },
            { x: end.x, y: end.y },
            { x: end.x + ox, y: end.y + oy },
            { x: start.x + ox, y: start.y + oy },
        ];

    }   

    static getEndPoint(start, directionPoint, length) {
        //Calculate the direction vector
        const dx = directionPoint.x - start.x;
        const dy = directionPoint.y - start.y;

        const distance = Math.hypot(dx, dy);

        if (distance === 0) {
            throw new Error('Direction point must differ from start');
        }

        if (!Number.isFinite(length) || length <= 0) {
            throw new Error('Length must be a positive number');
        }

        //Calculate unit vector
        const ux = dx / distance;
        const uy = dy / distance;

        //Return new endpoint
        return {
            x: start.x + (ux * length),
            y: start.y + (uy * length)
        };
    }
}