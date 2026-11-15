import { afterEach, expect, it, vi } from 'vitest';
import initProjectControls from '../ui/project-controls';

afterEach(() => vi.unstubAllGlobals());

it('routes the button and Ctrl/Cmd+S to save, suppressing browser save and repeated keys', () => {
    const document = new EventTarget();
    vi.stubGlobal('document', document);
    const controls = { name: new EventTarget(), save: new EventTarget(), newProject: new EventTarget() };
    const projects = { save: vi.fn() };
    initProjectControls(projects, controls);
    controls.save.dispatchEvent(new Event('click'));
    for (const modifier of ['ctrlKey', 'metaKey']) {
        const event = new Event('keydown', { cancelable: true });
        Object.assign(event, { key: 's', [modifier]: true });
        document.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
    }
    expect(projects.save).toHaveBeenCalledTimes(3);
    for (const properties of [{ key: 's' }, { key: 's', ctrlKey: true, repeat: true }, { key: 's', ctrlKey: true, shiftKey: true }]) {
        const event = new Event('keydown', { cancelable: true });
        Object.assign(event, properties);
        document.dispatchEvent(event);
    }
    expect(projects.save).toHaveBeenCalledTimes(3);
});
