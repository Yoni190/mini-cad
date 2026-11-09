export default class Wall {
    
    constructor ({ start, end, thickness = 200, height = 3000 }) {
        if(start.x === end.x && start.y === end.y) {
            throw new Error('Start and end points must not be identical.')
        }

        this.start = { ...start };
        this.end = { ...end };
        this.thickness = thickness;
        this.height = height;
    }

    getLength() {
        //Euclidean distance
        const dx = this.end.x - this.start.x;
        const dy = this.end.y - this.start.y;

        const length = Math.hypot(dx, dy);

        return length;
    }
}