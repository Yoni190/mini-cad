export default class ProjectService {
    constructor() {
        this.csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            .content;
    }
    
    async saveProject(name, elements) {
        // 1. Send the current drawing to Laravel
        const response = await fetch('/projects', {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': this.csrfToken
            },

            // Convert JavaScript data into a JSON string
            body: JSON.stringify({
                name: name,
                elements: elements
            })
        });

        // 2. Read the server response
        const data = await response.json();

        // 3. Check whether Laravel accepted the request
        if (!response.ok) {
            const validationErrors = data.errors
                ? Object.values(data.errors).flat().join(' ')
                : data.message;

            throw new Error(
                validationErrors || 'Failed to save project.'
            );
        }

        // 4. Return the created project from the response
        return data.project;
    }

}