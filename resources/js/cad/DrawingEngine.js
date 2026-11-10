import Wall from "./models/Wall";

export default class DrawingEngine {
    constructor (renderer) {
        this.renderer = renderer;
        this.elements = [];
        this.startPoint = null;
    }

    addWall (start, end) {
        //Create a wall instance
        const wall = new Wall({
            start,
            end
        });

        //Add the wall to this.elements
        this.elements.push(wall);

        //Render all elements
        this.render();
    }

    render (previewWall = null) {
        //Clear canvas
        this.renderer.clear();

        for (const element of this.elements) {
            this.renderer.drawWall(element);
        }

        if (previewWall) {
            this.renderer.drawWall(previewWall, true);
            this.renderer.drawWallLength(previewWall);
        }
    }
}