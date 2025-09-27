/**
 * Component Loader
 *
 * This module handles loading HTML components into the main page.
 */

class ComponentLoader {
    /**
     * Load a component into a target element
     *
     * @param {string} componentPath - Path to the component HTML file
     * @param {string} targetSelector - CSS selector for the target element
     * @returns {Promise} - Promise that resolves when the component is loaded
     */
    static async loadComponent(componentPath, targetSelector) {
        try {
            const response = await fetch(componentPath);

            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentPath}`);
            }

            const html = await response.text();
            const targetElement = document.querySelector(targetSelector);

            if (!targetElement) {
                throw new Error(`Target element not found: ${targetSelector}`);
            }

            targetElement.innerHTML = html;
            return true;
        } catch (error) {
            console.error('Error loading component:', error);
            return false;
        }
    }

    /**
     * Initialize all components on the page
     *
     * @param {Object} componentMap - Map of component paths to target selectors
     * @returns {Promise} - Promise that resolves when all components are loaded
     */
    static async initComponents(componentMap) {
        const loadPromises = [];

        for (const [componentPath, targetSelector] of Object.entries(componentMap)) {
            loadPromises.push(this.loadComponent(componentPath, targetSelector));
        }

        return Promise.all(loadPromises);
    }
}

export { ComponentLoader };