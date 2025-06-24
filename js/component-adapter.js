// js/component-adapter.js

/**
 * UI Component Adapter
 * Adapts UIManager to work with a dynamic component loading structure.
 */
export class UIComponentAdapter {
    static initialize(uiManager) {
        const originalShowPage = uiManager.showPage.bind(uiManager);

        uiManager.showPage = async function(pageId) {
            const componentMap = {
                'signup-billing-page': 'signup-billing',
                'user-dashboard-page': 'user-dashboard',
                'library-page': 'library',
                'admin-page': 'admin',
                'services-page': 'services-page',
                'about-us-page': 'about-us',
                'terms-conditions-page': 'terms-conditions'
            };

            const componentName = componentMap[pageId];
            if (componentName && window.componentManager) {
                await window.componentManager.loadComponent(componentName);

                // After dashboard component loads, update with user data
                if (componentName === 'user-dashboard' && window.simpliFinanceApp?.currentUserData) {
                    setTimeout(() => {
                        window.simpliFinanceApp.ui.dashboardManager.updateDashboard(window.simpliFinanceApp.currentUserData);
                    }, 100);
                }

                // After admin component loads, set up the admin UI
                if (componentName === 'admin' && window.simpliFinanceApp?.adminHandler) {
                    setTimeout(() => {
                        window.simpliFinanceApp.adminHandler.setupAdmin();
                    }, 100);
                }

                // Wait for component to be processed
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Call original method
            return originalShowPage(pageId);
        };
    }
}