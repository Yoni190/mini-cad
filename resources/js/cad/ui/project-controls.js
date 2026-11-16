/** Buttons and shortcuts share the same project actions. */
export default function initProjectControls(projects, controls) {
    window.addEventListener('beforeunload', event => {
        if (!projects.hasUnsavedChanges || projects.allowNavigation) return;
        
        event.preventDefault();
        event.returnValue = true;
    });
    controls.name.addEventListener('input', () => projects.setUnsavedChanges(true));
    controls.name.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            controls.name.blur();
        }
    });
    controls.name.addEventListener('blur', () => {
        const name = controls.name.value.trim() || 'Untitled Project';
        if (controls.name.value !== name) {
            controls.name.value = name;
            projects.setUnsavedChanges(true);
        }
    });
    controls.save.addEventListener('click', () => projects.save());
    controls.newProject.addEventListener('click', () => projects.createNew());
    document.addEventListener('keydown', event => {
        const isSaveShortcut = (event.ctrlKey || event.metaKey) &&
            !event.altKey && !event.shiftKey && event.key.toLowerCase() === 's';
        if (!isSaveShortcut) return;
        event.preventDefault();
        if (!event.repeat) projects.save();
    });
}
