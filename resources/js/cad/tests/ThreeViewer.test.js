import { afterEach, expect, it, vi } from 'vitest';
import ThreeViewer from '../ThreeViewer';

afterEach(() => vi.unstubAllGlobals());

it('coalesces redraws, continues while controls change, and stops when hidden', () => {
    let nextId = 0;
    const frames = new Map();
    vi.stubGlobal('requestAnimationFrame', callback => {
        frames.set(++nextId, callback);
        return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));

    const viewer = Object.create(ThreeViewer.prototype);
    viewer.visible = true;
    viewer.pendingFrame = null;
    let dampingFrames = 2;
    viewer.controls = { update: () => {
        if (dampingFrames-- > 0) viewer.requestRender();
    } };
    viewer.renderer = { render: vi.fn() };

    const runFrame = () => {
        const [id, callback] = frames.entries().next().value;
        frames.delete(id);
        callback();
    };

    viewer.requestRender();
    viewer.requestRender();
    expect(frames.size).toBe(1);
    runFrame();
    runFrame();
    runFrame();
    expect(viewer.renderer.render).toHaveBeenCalledTimes(3);
    expect(frames.size).toBe(0);

    viewer.requestRender();
    viewer.setVisible(false);
    viewer.requestRender();
    expect(frames.size).toBe(0);
    viewer.setVisible(true);
    expect(frames.size).toBe(1);
    runFrame();
    expect(viewer.renderer.render).toHaveBeenCalledTimes(4);
});
