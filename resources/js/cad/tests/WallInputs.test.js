import { afterEach, expect, it, vi } from 'vitest';
import createWallInputs from '../ui/wall-inputs';

afterEach(() => vi.unstubAllGlobals());

function setup() {
    const elements = {
        wallLength: { value: '' },
        newWallThickness: { value: '200', checkValidity: vi.fn(() => true), reportValidity: vi.fn(), focus: vi.fn() },
        toggleOrtho: { setAttribute: vi.fn(), textContent: '' },
    };
    vi.stubGlobal('document', { getElementById: id => elements[id] });
    return { elements, inputs: createWallInputs() };
}

it('reads and writes drafting inputs and presents the Ortho state', () => {
    const { elements, inputs } = setup();
    inputs.setLength('1200');
    expect(inputs.getLength()).toBe('1200');
    expect(inputs.getThickness()).toBe(200);
    inputs.setOrtho(true);
    expect(elements.toggleOrtho.setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
    expect(elements.toggleOrtho.textContent).toBe('Ortho: On');
    inputs.setOrtho(false);
    expect(elements.toggleOrtho.textContent).toBe('Ortho: Off');
});

it.each(['', '0', '-1', 'NaN', 'Infinity'])('rejects invalid thickness %s without preview messages', value => {
    const { elements, inputs } = setup();
    elements.newWallThickness.value = value;
    expect(inputs.getThickness()).toBeNull();
    expect(elements.newWallThickness.reportValidity).not.toHaveBeenCalled();
    expect(inputs.getThickness(true)).toBeNull();
    expect(elements.newWallThickness.reportValidity).toHaveBeenCalledOnce();
    expect(elements.newWallThickness.focus).toHaveBeenCalledOnce();
});

it('honors HTML validity constraints as well as positive finite values', () => {
    const { elements, inputs } = setup();
    elements.newWallThickness.checkValidity.mockReturnValue(false);
    expect(inputs.getThickness()).toBeNull();
});
