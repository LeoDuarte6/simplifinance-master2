// js/app.js
import { FirebaseConfig } from './config.js';
import { UIManager } from './ui.js';
import { FormValidator } from './validation.js';
import { AuthManager } from './app/auth-manager.js';
import { EventListeners } from './app/event-listeners.js';
import { PlanHandler } from './app/plan-handler.js';
import { SignupHandler } from './app/signup-handler.js';
import { DashboardHandler } from './app/dashboard-handler.js';
import { LibraryHandler } from './app/library-handler.js';
import { AdminHandler } from './app/admin-handler.js';
import { Router } from './routing/router.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

export class SimpliFinanceApp {
    constructor() {
        this.ui = new UIManager();
        this.app = null;
        this.auth = null;
        this.db = null;
        this.functions = null;

        // State
        this.currentUser = null;
        this.currentUserData = null;
        this.selectedPlan = null;
        this.signupFormData = {};
        this.isAdmin = false;
        this.authInitialized = false;

        // Handlers
        this.authManager = new AuthManager(this);
        this.planHandler = new PlanHandler(this);
        this.signupHandler = new SignupHandler(this);
        this.dashboardHandler = new DashboardHandler(this);
        this.libraryHandler = new LibraryHandler(this);
        this.eventListeners = new EventListeners(this);
        this.adminHandler = new AdminHandler(this);

        // Router
        this.router = new Router(this.ui.pageManager);
    }

    async initialize() {
        try {
            this.app = await FirebaseConfig.initialize();
            const services = await FirebaseConfig.getFirebaseServices(this.app);
            this.auth = services.auth;
            this.db = services.db;
            this.functions = services.functions;

            // Set initial auth flag
            this.authManager.isInitialAuthCheck = true;

            // The dynamic import was here; now it's a static import at the top.
            onAuthStateChanged(this.auth, (user) => {
                // Temporarily disable router during auth state handling to prevent circular dependency
                const routerTemp = this.ui.pageManager.router;
                this.ui.pageManager.router = null;

                this.authManager.handleAuthStateChange(user);

                // Re-enable router after auth state handling is complete
                this.ui.pageManager.router = routerTemp;

                // Mark auth as initialized
                this.authInitialized = true;

                // Initialize router only after first auth state is resolved
                if (this.authManager.isInitialAuthCheck) {
                    // Wait a moment for auth data to be processed
                    setTimeout(() => {
                        this.router.initialize();
                    }, 100);
                }
            });

            this.ui.initializeInputFormatters();
            FormValidator.initializeValidationListeners();

            this.eventListeners.setup();

            // Set up router connection
            this.ui.pageManager.setRouter(this.router);

            // Router will handle initial page display, but we need to listen for route changes
            window.addEventListener('routeChanged', (event) => {
                const { route } = event.detail;
                this.updateGetInTouchVisibility(route.pageId);
            });
        } catch (error) {
            console.error("Failed to initialize app:", error);
            console.error("Application failed to load. Please refresh.");
        }
    }

    updateGetInTouchVisibility(pageId) {
        const getInTouchSection = document.getElementById('get-in-touch-section');
        if (getInTouchSection) {
            const hasActiveSubscription = this.currentUserData?.subscriptionStatus === 'active';
            const shouldShow = pageId === 'home-page' && !hasActiveSubscription;
            getInTouchSection.style.display = shouldShow ? 'block' : 'none';
        }
    }
}