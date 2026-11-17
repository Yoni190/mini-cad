/** Binds property inputs to editor actions and presents selected dimensions. */
export default function initEditorControls(editor) {
    const wallLength = document.getElementById('wallLength');
    const columnWidth = document.getElementById('columnWidth');
    const columnDepth = document.getElementById('columnDepth');
    const columnHeight = document.getElementById('columnHeight');
    const wallThickness = document.getElementById('wallThickness');
    const wallHeight = document.getElementById('wallHeight');

    const wallDoors = document.getElementById('wallDoors');
    const removeWallDoor = document.getElementById('removeWallDoor');

    function showWallDoors(wall) {
        wallDoors.replaceChildren();

        const openings = wall?.type === 'wall' ? wall.openings : [];

        openings.forEach((opening, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            const name = opening.type === 'window' ? 'Window' : 'Door';
            option.textContent =
                `${name} ${index + 1}: ${Math.round(opening.offset)} mm from start`;
                
            wallDoors.appendChild(option);
        });

        removeWallDoor.disabled = openings.length === 0;
    }

    // Validation belongs to the action; presentation of its error belongs here.
    function runAction(action) {
        try {
            action();
        } catch (error) {
            alert(error.message);
        }
    }

    document.getElementById('applyWallLength').addEventListener('click', () => {
        runAction(() => editor.applyWallLength(Number(wallLength.value)));
    });
    document.getElementById('updateColumn').addEventListener('click', () => {
        runAction(() => editor.updateSelectedColumnDimensions(
            Number(columnWidth.value), Number(columnDepth.value), Number(columnHeight.value)
        ));
    });
    document.getElementById('updateWallThickness').addEventListener('click', () => {
        runAction(() => editor.updateSelectedWallThickness(wallThickness.value));
    });
    document.getElementById('updateWallHeight').addEventListener('click', () => {
        runAction(() => editor.updateSelectedWallHeight(wallHeight.value));
    });
    removeWallDoor.addEventListener('click', () => {
        runAction(() => {
            editor.removeSelectedWallDoor(Number(wallDoors.value));
            showWallDoors(editor.selectionManager.selectedElement);
        });
    })
    document.getElementById('newWallThickness').addEventListener('input', () => {
        editor.refreshWallPreview();
    });

    document.addEventListener('cad-selection-change', event => {
        const selected = event.detail;
        showWallDoors(selected);
        if (selected?.type === 'column') {
            columnWidth.value = selected.width;
            columnDepth.value = selected.depth;
            columnHeight.value = selected.height;
        }
        wallThickness.value = selected?.type === 'wall' ? selected.thickness : '';
        wallHeight.value = selected?.type === 'wall' ? selected.height : '';
    });
}
