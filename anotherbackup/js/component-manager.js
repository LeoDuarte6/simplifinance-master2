/**
 * Component Manager
 *
 * This module handles dynamic loading of components that aren't loaded on initial page load
 */

import { ComponentLoader } from './component-loader.js';

class ComponentManager {
    constructor() {
        // Map of components that should be loaded on demand
        this.dynamicComponents = {
            'signup-billing': {
                path: './components/signup-billing.html',
                target: '#signup-billing-page',
                loaded: false
            },
            'user-dashboard': {
                path: './components/user-dashboard.html',
                target: '#user-dashboard-page',
                loaded: false
            },
            'library': {
                path: './components/library.html',
                target: '#library-page',
                loaded: false
            },
            'admin': {
                path: './components/admin.html',
                target: '#admin-page',
                loaded: false
            },
            'services-page': {
                path: './components/services-page.html',
                target: '#services-page',
                loaded: false
            },
            'about-us': {
                path: './components/about-us.html',
                target: '#about-us-page',
                loaded: false
            },
            'terms-conditions': {
                path: './components/terms-conditions.html',
                target: '#terms-conditions-page',
                loaded: false
            }
        };
    }

    /**
     * Load a component if it hasn't been loaded yet
     *
     * @param {string} componentName - Name of the component to load
     * @returns {Promise<boolean>} - Promise that resolves to true if component was loaded successfully
     */
    async loadComponent(componentName) {
        const component = this.dynamicComponents[componentName];

        if (!component) {
            console.error(`Component not found: ${componentName}`);
            return false;
        }

        if (component.loaded) {
            return true;
        }

        try {
            const success = await ComponentLoader.loadComponent(component.path, component.target);

            if (success) {
                component.loaded = true;
            }

            return success;
        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
            return false;
        }
    }

    /**
     * Check if a component has been loaded
     *
     * @param {string} componentName - Name of the component to check
     * @returns {boolean} - True if component is loaded
     */
    isComponentLoaded(componentName) {
        const component = this.dynamicComponents[componentName];
        return component ? component.loaded : false;
    }
}

export { ComponentManager };