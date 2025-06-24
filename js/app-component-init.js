/**
 * App Component Initialization
 *
 * This module initializes the application with the component structure
 */

import { UIComponentAdapter } from './component-adapter.js';

// Global flag to prevent duplicate initialization
let componentsInitialized = false;

/**
 * Initialize the application with component structure
 * This is now called directly from the main initialization in index.html
 */
export function initializeWithComponents() {
    // Prevent duplicate initialization
    if (componentsInitialized) {
        console.warn('Components already initialized, skipping');
        return;
    }

    // Mark as initialized
    componentsInitialized = true;

    // Set up observers for component visibility
    observePageChanges();

    // Setup component load handlers for form controls
    setupComponentLoadHandlers();
}

/**
 * Setup component load handlers to initialize UI functionality after components load
 */
function setupComponentLoadHandlers() {
    if (!window.simpliFinanceApp || !window.simpliFinanceApp.ui) {
        console.warn('Cannot set up component handlers - app not ready');
        return;
    }

    // Set up observer for login page to initialize password toggle
    const loginObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                // Check if login component has been loaded
                const loginPage = document.getElementById('login-page');
                if (loginPage && !loginPage.classList.contains('hidden')) {
                    // Login page is visible, check if password toggle is available
                    const passwordInput = document.getElementById('password-login');
                    if (passwordInput) {
                        // Setup login password toggle after component is loaded
                        if (window.simpliFinanceApp?.ui?.setupLoginPasswordToggle) {
                            window.simpliFinanceApp.ui.setupLoginPasswordToggle();
                        }

                        // Stop observing after setup
                        loginObserver.disconnect();
                    }
                }
            }
        });
    });

    // Start observing the entire document
    loginObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Observe changes to page sections to update component visibility
 */
function observePageChanges() {
    // Get all page sections
    const pageSections = document.querySelectorAll('.page-section');

    // Set up mutation observer for page changes
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const section = mutation.target;
                const isVisible = !section.classList.contains('hidden');

                if (isVisible) {
                    // A section became visible, it's the current page
                    const pageId = section.id;
                    // Update Get in Touch section visibility
                    updateGetInTouchVisibility(pageId);

                    // Try to set up page-specific controls
                    if (pageId === 'login-page' && window.simpliFinanceApp?.ui) {
                        setTimeout(() => {
                            if (window.simpliFinanceApp?.ui?.setupLoginPasswordToggle) {
                                window.simpliFinanceApp.ui.setupLoginPasswordToggle();
                            }
                        }, 100);
                    }
                }
            }
        });
    });

    // Start observing all page sections
    pageSections.forEach(section => {
        observer.observe(section, { attributes: true });
    });

    // Initial check on page load
    const currentPageId = getCurrentPageId();
    updateGetInTouchVisibility(currentPageId);
}

/**
 * Get current visible page ID
 */
function getCurrentPageId() {
    const visiblePage = document.querySelector('.page-section:not(.hidden)');
    return visiblePage ? visiblePage.id : 'home-page'; // Default to home page
}

/**
 * Control visibility of the Get in Touch section
 */
function updateGetInTouchVisibility(pageId) {
    const getInTouchSection = document.getElementById('get-in-touch-section');
    if (getInTouchSection) {
        // Only show on home page
        getInTouchSection.style.display = pageId === 'home-page' ? 'block' : 'none';
    }
}

// Export the initialization function to be called from main initialization