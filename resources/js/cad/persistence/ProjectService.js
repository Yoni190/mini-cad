export default class ProjectService {
    constructor() {
        this.csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            .content;
    }
    
    async saveProject(name, elements) {
        const response = await fetch('/projects', {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': this.csrfToken
            },

            body: JSON.stringify({
                name: name,
                elements: elements
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const validationErrors = data.errors
                ? Object.values(data.errors).flat().join(' ')
                : data.message;

            throw new Error(
                validationErrors || 'Failed to save project.'
            );
        }

        return data.project;
    }

    async updateProject(id, name, elements, version) {
        const response = await fetch(`/projects/${id}`, {
            method: 'PUT',

            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': this.csrfToken
            },

            body: JSON.stringify({ name, elements, version })
        });

        const data = await response.json();

        if (!response.ok) {
            const errors = data.errors
                ? Object.values(data.errors).flat().join(' ')
                : data.message;

            throw new Error(errors || 'Failed to update project.');
        }

        return data;
    }

}
