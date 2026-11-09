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
}