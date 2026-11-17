const CELL_SIZE = 1000;
const MAX_CELLS = 1024;

export default class WallSpatialIndex {
    constructor(walls) {
        this.walls = walls;
        this.cells = new Map();
        this.disabled = false;

        walls.forEach((wall, index) => {
            if (this.disabled) return;

            const minX = Math.floor(Math.min(wall.start.x, wall.end.x) / CELL_SIZE);
            const maxX = Math.floor(Math.max(wall.start.x, wall.end.x) / CELL_SIZE);
            const minY = Math.floor(Math.min(wall.start.y, wall.end.y) / CELL_SIZE);
            const maxY = Math.floor(Math.max(wall.start.y, wall.end.y) / CELL_SIZE);
            const cellCount = (maxX - minX + 1) * (maxY - minY + 1);

            if (cellCount > MAX_CELLS) {
                this.disabled = true;
                this.cells.clear();
                return;
            }

            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    const key = `${x},${y}`;

                    if (!this.cells.has(key)) this.cells.set(key, []);
                    this.cells.get(key).push(index);
                }
            }
        });
    }

    findNear(point, tolerance) {
        if (this.disabled) return this.walls;

        const minX = Math.floor((point.x - tolerance) / CELL_SIZE);
        const maxX = Math.floor((point.x + tolerance) / CELL_SIZE);
        const minY = Math.floor((point.y - tolerance) / CELL_SIZE);
        const maxY = Math.floor((point.y + tolerance) / CELL_SIZE);
        const cellCount = (maxX - minX + 1) * (maxY - minY + 1);

        if (cellCount > MAX_CELLS) return this.walls;

        const candidates = new Set();

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (const index of this.cells.get(`${x},${y}`) ?? []) {
                    candidates.add(index);
                }
            }
        }

        return [...candidates]
            .sort((a, b) => a - b)
            .map(index => this.walls[index]);
    }
}