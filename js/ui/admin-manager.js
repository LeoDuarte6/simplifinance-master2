import { UIHelpers } from './ui-helpers.js';

export class AdminManager {
    constructor() {
        this.initialized = false;
    }

    /**
     * Initialize the admin dashboard UI
     */
    initializeAdminUI() {
        if (this.initialized) return;

        this.setupLogoutButton();
        this.setupAdminFormListeners();

        this.initialized = true;
    }

    /**
     * Setup the admin logout button
     */
    setupLogoutButton() {
        const adminLogoutButton = document.getElementById('admin-logout-button');
        if (adminLogoutButton && !adminLogoutButton.dataset.listenerAttached) {
            adminLogoutButton.addEventListener('click', () => window.simpliFinanceApp?.authManager.signOut());
            adminLogoutButton.dataset.listenerAttached = 'true';
        }
    }

    /**
     * Set up admin form event listeners
     */
    setupAdminFormListeners() {
        const uploadForm = document.getElementById('admin-upload-form');
        if (uploadForm && !uploadForm.dataset.listenerAttached) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                window.simpliFinanceApp?.adminHandler.handleContentUpload(e);
            });
            uploadForm.dataset.listenerAttached = 'true';
        }

    }
}