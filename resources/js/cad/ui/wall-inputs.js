/** DOM adapter for drafting values and validation feedback; owns no drafting state. */
export default function createWallInputs() {
    const length = document.getElementById('wallLength');
    const thickness = document.getElementById('newWallThickness');
    const ortho = document.getElementById('toggleOrtho');

    return {
        getLength: () => length.value,
        setLength: value => { length.value = value; },
        getThickness(reportInvalid = false) {
            const value = Number(thickness.value);
            if (Number.isFinite(value) && value > 0 && thickness.checkValidity()) return value;
            if (reportInvalid) {
                thickness.reportValidity();
                thickness.focus();
            }
            return null;
        },
        setOrtho(enabled) {
            ortho.setAttribute('aria-pressed', String(enabled));
            ortho.textContent = enabled ? 'Ortho: On' : 'Ortho: Off';
        },
    };
}
