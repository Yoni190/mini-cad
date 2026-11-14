// Presentation only: retain the existing selector, events, and operation locks.
export default function initEditorUI() {
    const toolSelect = document.getElementById('drawingTool');
    const toolButtons = document.querySelectorAll('[data-tool]');
    const help = document.getElementById('activeToolHelp');
    const twoContainer = document.getElementById('twoContainer');
    const threeContainer = document.getElementById('threeContainer');
    let selectedElement = null;
    const instructions = {
        wall: 'Wall: Click a start point, then an end point. Use Properties for an exact length.',
        column: 'Column: Click to place a column. Choose Select to move or resize it.',
        select: 'Select: Click an element. Drag a selected column to move it. Delete to remove.',
    };

    document.addEventListener('cad-selection-change', (event) => {
        selectedElement = event.detail;
        syncUI();
    });

    function syncUI() {
        const tool = toolSelect.value;
        const is3D = threeContainer.style.display !== 'none';
        document.body.dataset.activeTool = tool;
        toolButtons.forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
            button.disabled = toolSelect.disabled;
        });
        document.getElementById('wallProperties').hidden = tool !== 'wall';
        document.getElementById('columnProperties').hidden =
            tool !== 'select' || selectedElement?.type !== 'column';

        document.getElementById('wallThicknessProperties').hidden =
            tool !== 'select' || selectedElement?.type !== 'wall';
        document.getElementById('columnPlacementHelp').hidden = tool !== 'column';
        document.getElementById('show2D').setAttribute('aria-pressed', String(!is3D));
        document.getElementById('show3D').setAttribute('aria-pressed', String(is3D));
        document.getElementById('viewHeading').textContent = is3D ? '3D model' : '2D drawing';
        help.textContent = is3D ? '3D: Drag to orbit · Scroll to zoom · Right-drag to pan' : instructions[tool];
        document.getElementById('navigationHelp').hidden = is3D;
    }

    toolButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (toolSelect.disabled || toolSelect.value === button.dataset.tool) return;
            toolSelect.value = button.dataset.tool;
            toolSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    toolSelect.addEventListener('change', syncUI);
    // Follow existing busy/view state without changing the project or CAD handlers.
    const observer = new MutationObserver(syncUI);
    observer.observe(toolSelect, { attributes: true, attributeFilter: ['disabled'] });
    observer.observe(twoContainer, { attributes: true, attributeFilter: ['style'] });
    observer.observe(threeContainer, { attributes: true, attributeFilter: ['style'] });
    syncUI();
}
