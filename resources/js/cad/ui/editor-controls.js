/** Binds property inputs to editor actions and presents selected dimensions. */
export default function initEditorControls(editor) {
    const wallLength = document.getElementById('wallLength');
    const columnWidth = document.getElementById('columnWidth');
    const columnDepth = document.getElementById('columnDepth');
    const wallThickness = document.getElementById('wallThickness');
    const wallHeight = document.getElementById('wallHeight');

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
            Number(columnWidth.value), Number(columnDepth.value)
        ));
    });
    document.getElementById('updateWallThickness').addEventListener('click', () => {
        runAction(() => editor.updateSelectedWallThickness(wallThickness.value));
    });
    document.getElementById('updateWallHeight').addEventListener('click', () => {
        runAction(() => editor.updateSelectedWallHeight(wallHeight.value));
    });
    document.getElementById('newWallThickness').addEventListener('input', () => {
        editor.refreshWallPreview();
    });

    document.addEventListener('cad-selection-change', event => {
        const selected = event.detail;
        if (selected?.type === 'column') {
            columnWidth.value = selected.width;
            columnDepth.value = selected.depth;
        }
        wallThickness.value = selected?.type === 'wall' ? selected.thickness : '';
        wallHeight.value = selected?.type === 'wall' ? selected.height : '';
    });
}
