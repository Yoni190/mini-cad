import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectionManager from '../interaction/SelectionManager';
import DrawingEngine from '../DrawingEngine';
import DrawingView from '../rendering/DrawingView';
import EditorController from '../interaction/EditorController';
import Wall from '../models/Wall';
import Column from '../models/Column';

afterEach(() => vi.unstubAllGlobals());

function setup() {
    const engine = new DrawingEngine();
    const renderer = {
        clear: vi.fn(),
        drawGrid: vi.fn(),
        isGeometryVisible: vi.fn(() => true),
        drawElement: vi.fn(),
    };
    const previewRenderer = { clear: vi.fn() };
    const view = new DrawingView(engine, renderer, previewRenderer);
    return { engine, renderer, previewRenderer, view };
}

describe('DrawingView', () => {
    it('lets the engine change data without drawing until the view is requested', () => {
        const { engine, renderer, view } = setup();

        engine.addWall({ x: 0, y: 0 }, { x: 1000, y: 0 });
        engine.addColumn({ x: 2000, y: 2000 });

        expect(engine).not.toHaveProperty('renderer');
        expect(engine).not.toHaveProperty('render');
        expect(renderer.drawElement).not.toHaveBeenCalled();
        view.render();
        expect(renderer.drawElement).toHaveBeenCalledTimes(2);
    });

    it.each(['wall', 'column', 'none'])('renders joined footprints and highlights the selected %s', selectedType => {
        const { engine, renderer, previewRenderer, view } = setup();
        const first = new Wall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } });
        const second = new Wall({ start: first.end, end: { x: 4000, y: 3000 } });
        const column = new Column({ position: { x: 1000, y: 1000 } });
        engine.replaceElements([first, second, column]);
        const selected = selectedType === 'wall' ? first : selectedType === 'column' ? column : null;
        const before = JSON.stringify(engine.elements);

        view.render(new Set(selected ? [selected.id] : []));

        expect(renderer.clear).toHaveBeenCalledTimes(1);
        expect(renderer.drawGrid).toHaveBeenCalledTimes(1);
        expect(renderer.drawElement).toHaveBeenCalledTimes(3);
        const firstDraw = renderer.drawElement.mock.calls[0];
        expect(firstDraw.slice(0, 3)).toEqual([first, false, selected === first]);
        expect(firstDraw[3][2]).toEqual({ x: 3800, y: 200 });
        expect(renderer.drawElement).toHaveBeenCalledWith(
            column, false, selected === column, column.getGeometry()
        );
        expect(previewRenderer.clear).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(engine.elements)).toBe(before);
    });

    it('skips offscreen elements while drawing the grid and clearing the preview', () => {
        const { engine, renderer, previewRenderer, view } = setup();
        engine.addColumn({ x: 1000, y: 1000 });
        renderer.isGeometryVisible.mockReturnValue(false);

        view.render();

        expect(renderer.drawElement).not.toHaveBeenCalled();
        expect(renderer.drawGrid).toHaveBeenCalledTimes(1);
        expect(previewRenderer.clear).toHaveBeenCalledTimes(1);
    });

    it('draws an empty project without a preview renderer', () => {
        const { engine, renderer } = setup();
        const view = new DrawingView(engine, renderer);
        view.render();
        expect(renderer.clear).toHaveBeenCalledTimes(1);
        expect(renderer.drawGrid).toHaveBeenCalledTimes(1);
        expect(renderer.drawElement).not.toHaveBeenCalled();
    });
});

describe('scheduled redraws after model changes', () => {
    it('combines model changes into one frame and uses the current selection', () => {
        const { engine, renderer, view } = setup();
        const selection = new SelectionManager();
        const controller = new EditorController(null, engine, renderer, null, selection, view);
        let drawFrame;
        const requestFrame = vi.fn(callback => {
            drawFrame = callback;
            return 1;
        });
        vi.stubGlobal('requestAnimationFrame', requestFrame);
        engine.onModelChange = () => controller.scheduleCanvasRender();

        engine.addColumn({ x: 1000, y: 1000 });
        const column = engine.elements[0];
        engine.updateColumnDimensions(column.id, 600, 800);
        selection.selectedElements = [column];

        expect(requestFrame).toHaveBeenCalledTimes(1);
        expect(renderer.drawElement).not.toHaveBeenCalled();
        drawFrame();

        expect(renderer.drawElement).toHaveBeenCalledWith(column, false, true, [
            { x: 1000, y: 1000 }, { x: 1600, y: 1000 },
            { x: 1600, y: 1800 }, { x: 1000, y: 1800 },
        ]);
    });

    it('clears the previous picture when a project is replaced', () => {
        const { engine, renderer, previewRenderer, view } = setup();
        const controller = new EditorController(null, engine, renderer, null, new SelectionManager(), view);
        let drawFrame;
        vi.stubGlobal('requestAnimationFrame', callback => {
            drawFrame = callback;
            return 1;
        });
        engine.addColumn({ x: 1000, y: 1000 });
        view.render();
        renderer.drawElement.mockClear();
        engine.onModelChange = () => controller.scheduleCanvasRender();

        engine.replaceElements([]);
        drawFrame();

        expect(renderer.clear).toHaveBeenCalledTimes(2);
        expect(renderer.drawElement).not.toHaveBeenCalled();
        expect(previewRenderer.clear).toHaveBeenCalledTimes(2);
    });
});
