import Wall from "./models/Wall";
import Column from "./models/Column";

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

    addColumn(position) {
        //Create a column instance
        const column = new Column({ position });

        //Add the column to this.elements
        this.elements.push(column);

        //Render all elements
        this.render();
    }

    render (previewWall = null, selectedId = null) {
        //Clear canvas
        this.renderer.clear();

        for (const element of this.elements) {
            const isSelected = element.id === selectedId;

            this.renderer.drawElement(element, false, isSelected);
        }

        if (previewWall) {
            this.renderer.drawElement(previewWall, true);

            if(previewWall.type === 'wall'){
                this.renderer.drawWallLength(previewWall);
            }
        }
    }

    removeElement(id) {
        this.elements = this.elements.filter(
            element => element.id !== id
        );

        this.render();
    }
}