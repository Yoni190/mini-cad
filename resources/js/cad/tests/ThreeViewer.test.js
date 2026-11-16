import { afterEach, expect, it, vi } from 'vitest';
import ThreeViewer from '../rendering/ThreeViewer';
import * as THREE from 'three';
import Wall from '../models/Wall';

afterEach(() => vi.unstubAllGlobals());

it('adds a floor for a closed room and removes it when the room opens', () => {
    const viewer = Object.create(ThreeViewer.prototype);
    viewer.floorsGroup = new THREE.Group();
    viewer.elementsGroup = new THREE.Group();
    viewer.elementMeshes = new Map();
    viewer.requestRender = vi.fn();
    const points = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 2000 }, { x: 0, y: 2000 }];
    const walls = points.map((start, i) => new Wall({ start, end: points[(i + 1) % points.length] }));

    viewer.updateElements(walls);
    expect(viewer.floorsGroup.children).toHaveLength(1);
    const floor = viewer.floorsGroup.children[0];
    const dispose = vi.spyOn(floor.geometry, 'dispose');

    viewer.updateElements(walls.slice(0, -1));
    expect(viewer.floorsGroup.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledOnce();
});

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
