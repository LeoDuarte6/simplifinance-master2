// js/routing/router.js

export class Router {
    constructor(pageManager) {
        this.pageManager = pageManager;
        this.routes = new Map();
        this.currentRoute = null;
        this.isNavigating = false;
        this.isInitialized = false;

        // Define route mappings
        this.defineRoutes();

        // Set up event listeners
        this.setupEventListeners();
    }

    defineRoutes() {
        // Map URLs to page IDs and metadata
        this.routes.set('/', {
            pageId: 'home-page',
            title: 'SimpliFinance - Wealth Education Platform',
            requiresAuth: false,
            adminOnly: false
        });

        this.routes.set('/about', {
            pageId: 'about-us-page',
            title: 'About Us - SimpliFinance',
            requiresAuth: false,
            adminOnly: false
        });

        this.routes.set('/services', {
            pageId: 'services-page',
            title: 'Services - SimpliFinance',
            requiresAuth: false,
            adminOnly: false
        });

        this.routes.set('/login', {
            pageId: 'login-page',
            title: 'Login - SimpliFinance',
            requiresAuth: false,
            adminOnly: false
        });

        this.routes.set('/signup', {
            pageId: 'signup-billing-page',
            title: 'Sign Up - SimpliFinance',
            requiresAuth: false,
            adminOnly: false
        });

        this.routes.set('/dashboard', {
            pageId: 'user-dashboard-page',
            title: 'Dashboard - SimpliFinance',
            requiresAuth: true,
            adminOnly: false
        });

        this.routes.set('/library', {
            pageId: 'library-page',
            title: 'Educational Library - SimpliFinance',
            requiresAuth: true,
            adminOnly: false
        });

        this.routes.set('/admin', {
            pageId: 'admin-page',
            title: 'Admin Panel - SimpliFinance',
            requiresAuth: true,
            adminOnly: true
        });

        this.routes.set('/terms-conditions', {
            pageId: 'terms-conditions-page',
            title: 'Terms & Conditions - SimpliFinance',
            requiresAuth: false,
            adminOnly: false
        });
    }

    setupEventListeners() {
        // Handle browser back/forward buttons
        window.addEventListener('popstate', async (event) => {
            if (event.state && event.state.route) {
                await this.navigateToRoute(event.state.route, false);
            } else {
                await this.handleCurrentPath();
            }
        });

        // Prevent default link behavior and use router instead
        document.addEventListener('click', async (event) => {
            const link = event.target.closest('a[href^="/"]');
            if (link && !link.hasAttribute('data-external')) {
                event.preventDefault();
                const href = link.getAttribute('href');
                await this.navigateTo(href);
            }
        });
    }

    async initialize() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // Handle initial route after everything is set up
        // Add a small delay to ensure Firebase auth state is resolved before initial routing
        setTimeout(() => {
            this.handleCurrentPath();
        }, 100);
    }

    async handleInitialRoute() {
        await this.handleCurrentPath();
    }

    async handleCurrentPath() {
        const path = window.location.pathname;
        const route = this.findRoute(path);

        if (route) {
            // Re-evaluate access permissions on direct URL access
            if (!this.canAccessRoute(route)) {
                // The canAccessRoute method will handle redirection
                return;
            }
            await this.navigateToRoute(route, false);
        } else {
            // Fallback to home page for unknown routes
            await this.navigateTo('/', true);
        }
    }

    findRoute(path) {
        // Exact match first
        if (this.routes.has(path)) {
            return { path, ...this.routes.get(path) };
        }

        // Remove trailing slash and try again
        const normalizedPath = path.replace(/\/$/, '') || '/';
        if (this.routes.has(normalizedPath)) {
            return { path: normalizedPath, ...this.routes.get(normalizedPath) };
        }

        return null;
    }

    async navigateTo(path, replace = false) {
        if (this.isNavigating) return;

        const route = this.findRoute(path);
        if (!route) {
            console.warn(`Route not found: ${path}`);
            return;
        }

        // Check authentication and authorization
        if (!this.canAccessRoute(route)) {
            return;
        }

        await this.navigateToRoute(route, true, replace);
    }

    async navigateToRoute(route, updateHistory = true, replace = false) {
        if (this.isNavigating) return;
        this.isNavigating = true;

        try {
            // Update browser history
            if (updateHistory) {
                const stateObj = { route: route.path };
                if (replace) {
                    window.history.replaceState(stateObj, route.title, route.path);
                } else {
                    window.history.pushState(stateObj, route.title, route.path);
                }
            }

            // Update document title
            document.title = route.title;

            // Navigate to the page using the app's UI manager (which has component loading)
            const app = window.simpliFinanceApp;
            const componentManager = window.componentManager;

            if (app && app.ui && app.ui.showPage && componentManager) {
                await app.ui.showPage(route.pageId);
            } else {
                this.pageManager.showPage(route.pageId);
            }

            // Handle special page setup
            this.handlePageSpecificSetup(route);

            // Store current route
            this.currentRoute = route;

            // Emit navigation event for other components to listen to
            window.dispatchEvent(new CustomEvent('routeChanged', {
                detail: { route, previousRoute: this.currentRoute }
            }));

        } finally {
            this.isNavigating = false;
        }
    }

    canAccessRoute(route) {
        const app = window.simpliFinanceApp;

        // If auth hasn't been initialized yet, allow navigation and let auth state change handle redirection
        if (!app?.authInitialized) {
            return true;
        }

        // Check if authentication is required
        if (route.requiresAuth && !app?.currentUser) {
            console.log('Protected route requires authentication. Redirecting to login.');
            this.navigateTo('/login', true);
            return false;
        }

        // Check if user is trying to access admin-only route
        if (route.adminOnly && !app?.isAdmin) {
            console.log('Admin-only route accessed by non-admin user. Redirecting to home.');
            this.navigateTo('/', true);
            return false;
        }

        // Check if admin is trying to access dashboard
        if (route.pageId === 'user-dashboard-page' && app?.isAdmin) {
            console.log('Admin user redirected from dashboard to admin panel.');
            this.navigateTo('/admin', true);
            return false;
        }

        // Check if user is already logged in and trying to access login/signup
        if (route.pageId === 'login-page' && app?.currentUser) {
            console.log('Logged in user tried to access login page. Redirecting to home.');
            this.navigateTo('/', true);
            return false;
        }

        // Allow access to signup page for cancelled subscriptions (for resubscription)
        if (route.pageId === 'signup-billing-page' && app?.currentUser) {
            const isActiveSubscription = app?.currentUserData?.subscriptionStatus === 'active';
            if (isActiveSubscription) {
                console.log('User with active subscription tried to access signup. Redirecting to home.');
                this.navigateTo('/', true);
                return false;
            }
            // Allow cancelled or no subscription users to access signup
        }

        return true;
    }

    getCurrentRoute() {
        return this.currentRoute;
    }

    getRouteByPageId(pageId) {
        for (const [path, routeData] of this.routes) {
            if (routeData.pageId === pageId) {
                return { path, ...routeData };
            }
        }
        return null;
    }

    // Helper method to get route path by page ID
    getPathByPageId(pageId) {
        const route = this.getRouteByPageId(pageId);
        return route ? route.path : null;
    }

    // Method for programmatic navigation from other components
    showPage(pageId) {
        const route = this.getRouteByPageId(pageId);
        if (route) {
            this.navigateTo(route.path);
        } else {
            console.warn(`No route found for page ID: ${pageId}`);
            // Fallback to the old method
            this.pageManager.showPage(pageId);
        }
    }

    // Handle page-specific setup tasks
    handlePageSpecificSetup(route) {
        const app = window.simpliFinanceApp;
        if (!app) return;

        switch (route.pageId) {
            case 'library-page':
                // Load library content when navigating to library
                if (app.libraryHandler && app.currentUser) {
                    setTimeout(() => {
                        app.libraryHandler.loadLibraryContent();
                    }, 100);
                }
                break;

            case 'user-dashboard-page':
                // Update dashboard data and setup event listeners when navigating to dashboard
                if (app.ui.dashboardManager && app.dashboardHandler) {
                    setTimeout(() => {
                        app.dashboardHandler.setupDashboard();
                        if (app.currentUserData) {
                            app.ui.dashboardManager.updateDashboard(app.currentUserData);
                        }
                    }, 400);
                }
                break;

            case 'signup-billing-page':
                // Setup signup form elements and event listeners
                if (app.ui.signupFormManager && app.signupHandler) {
                    setTimeout(() => {
                        app.ui.signupFormManager.setupSignupFormElements();
                        app.signupHandler.setupMultiStepSignup();
                    }, 200);
                }
                break;
        }
    }
}